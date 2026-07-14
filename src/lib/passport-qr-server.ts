import QRCode from "qrcode"
import { createAdminClient } from "@/lib/supabase/admin"
import { createHash, createHmac, randomBytes } from "node:crypto"

const BUCKET = "passport-qr"

export type PassportQrResult = {
  publicPageUrl: string
  imageDataUrl: string
  imagePublicUrl: string
  qrCodeRowId: string
  qrIdentityId?: string
}

export type MintPassportQrBatchResult = {
  /** First minted identity — used for wizard preview. */
  primary: PassportQrResult
  minted: PassportQrResult[]
  totalMinted: number
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
}

function signQrPath(pathname: string, ts: string): string {
  const secret =
    process.env.QR_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "originpass-dev-signing-key"
  return createHmac("sha256", secret).update(`${pathname}:${ts}`).digest("hex")
}

function issueQrToken() {
  const token = randomBytes(24).toString("base64url")
  const tokenHash = createHash("sha256").update(token).digest("hex")
  return { token, tokenHash }
}

async function ensureBucket(): Promise<void> {
  const admin = createAdminClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) {
    console.warn("passport-qr bucket list:", listError.message)
    return
  }
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (!exists) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ["image/png"],
    })
    if (error && !error.message?.includes("already exists")) {
      console.warn("passport-qr bucket create:", error.message)
    }
  }
}

function pickPublicUrl(row: Record<string, unknown>, fallback: string): string {
  const a = row.qr_url ?? row.verify_url ?? row.qr_value
  return typeof a === "string" && a.length > 0 ? a : fallback
}

function pickImageUrl(row: Record<string, unknown>, fallback: string): string {
  const spec = row.label_spec
  if (spec && typeof spec === "object" && spec !== null && "qrImageUrl" in spec) {
    const u = (spec as { qrImageUrl?: string }).qrImageUrl
    if (typeof u === "string" && u.length > 0) return u
  }
  return fallback
}

type MintSingleInput = {
  passportId: string
  organizationId: string | null
  productId: string | null
  qrIdentityDisplayName?: string | null
  qrIdentityMetadata?: Record<string, unknown> | null
  /** 1-based index when minting a production batch for the same passport. */
  mintIndex?: number
  mintTotal?: number
}

/** Always creates a new signed QR URL, qr_codes row, and qr_identities row. */
async function mintSinglePassportQrIdentity(input: MintSingleInput): Promise<PassportQrResult> {
  const admin = createAdminClient()
  const issuedAt = new Date().toISOString()
  const { token, tokenHash } = issueQrToken()
  const pathname = `/scan/${input.passportId}`
  const sig = signQrPath(pathname, issuedAt)
  const publicPageUrl = `${baseUrl()}${pathname}?qt=${token}&ts=${encodeURIComponent(issuedAt)}&sig=${sig}`

  await ensureBucket()

  const png = await QRCode.toBuffer(publicPageUrl, { type: "png", width: 320, margin: 2 })
  const storagePath = `${input.passportId}/${randomBytes(8).toString("hex")}.png`

  const { data: up, error: upError } = await admin.storage.from(BUCKET).upload(storagePath, png, {
    contentType: "image/png",
    upsert: false,
  })

  if (upError) {
    throw new Error(upError.message || "QR image upload failed")
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(up?.path ?? storagePath)
  const imagePublicUrl = pub.publicUrl
  const imageDataUrl = await QRCode.toDataURL(publicPageUrl, { width: 320, margin: 2 })
  const labelSpec = { qrImageUrl: imagePublicUrl, publicPageUrl }

  const attempts: Record<string, unknown>[] = [
    {
      passport_id: input.passportId,
      qr_value: publicPageUrl,
      qr_url: publicPageUrl,
      verify_url: publicPageUrl,
      format: "png",
      label_spec: labelSpec,
      organization_id: input.organizationId ?? undefined,
    },
    {
      passport_id: input.passportId,
      qr_value: publicPageUrl,
      qr_url: publicPageUrl,
      organization_id: input.organizationId ?? undefined,
    },
    {
      passport_id: input.passportId,
      verify_url: publicPageUrl,
      format: "png",
      label_spec: labelSpec,
    },
  ]

  let lastErr: Error | null = null
  for (const payload of attempts) {
    const clean = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined),
    ) as Record<string, unknown>

    const { data: inserted, error } = await admin.from("qr_codes").insert(clean).select("id").single()
    if (!error && inserted?.id) {
      let qrIdentityId: string | undefined
      if (input.productId) {
        const metadata: Record<string, unknown> = {
          ...(input.qrIdentityMetadata ?? {}),
        }
        if (input.mintIndex != null && input.mintTotal != null) {
          metadata.mint_index = input.mintIndex
          metadata.mint_total = input.mintTotal
        }

        const identityPayload: Record<string, unknown> = {
          product_id: input.productId,
          organization_id: input.organizationId,
          qr_code: String(inserted.id),
          qr_token_hash: tokenHash,
          qr_url: publicPageUrl,
          activation_status: "active",
          issued_at: issuedAt,
        }
        if (input.qrIdentityDisplayName) {
          identityPayload.display_name =
            input.mintTotal != null && input.mintTotal > 1 && input.mintIndex != null
              ? `${input.qrIdentityDisplayName} #${input.mintIndex}`
              : input.qrIdentityDisplayName
        }
        if (Object.keys(metadata).length > 0) {
          identityPayload.metadata = metadata
        }
        const { data: qrIdentity } = await admin.from("qr_identities").insert(identityPayload).select("id").single()
        qrIdentityId = qrIdentity?.id as string | undefined
        if (qrIdentityId) {
          await admin.from("products").update({ qr_identity_id: qrIdentityId }).eq("id", input.productId)
        }
      }
      return {
        publicPageUrl,
        imageDataUrl,
        imagePublicUrl,
        qrCodeRowId: inserted.id as string,
        qrIdentityId,
      }
    }
    lastErr = error ? new Error(error.message) : lastErr
  }

  throw lastErr ?? new Error("Failed to save QR record")
}

/**
 * Mint N unique cryptographic QR identities for one master passport record.
 * Used by the product wizard production batch step.
 */
export async function mintPassportQrIdentities(input: {
  passportId: string
  organizationId: string | null
  quantity: number
  qrIdentityDisplayName?: string | null
  qrIdentityMetadata?: Record<string, unknown> | null
}): Promise<MintPassportQrBatchResult> {
  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("product_id")
    .eq("id", input.passportId)
    .maybeSingle()

  const productId = (passport?.product_id as string | null) ?? null
  const minted: PassportQrResult[] = []

  for (let i = 0; i < input.quantity; i += 1) {
    const result = await mintSinglePassportQrIdentity({
      passportId: input.passportId,
      organizationId: input.organizationId,
      productId,
      qrIdentityDisplayName: input.qrIdentityDisplayName,
      qrIdentityMetadata: input.qrIdentityMetadata,
      mintIndex: i + 1,
      mintTotal: input.quantity,
    })
    minted.push(result)
  }

  return {
    primary: minted[0]!,
    minted,
    totalMinted: minted.length,
  }
}

/**
 * Idempotent: returns existing qr_codes row for passport when present.
 * Generates PNG, uploads to storage, persists qr_codes (admin).
 */
export async function generateAndStorePassportQr(input: {
  passportId: string
  organizationId: string | null
  /** Optional wizard snapshot persisted on qr_identities when columns exist. */
  qrIdentityDisplayName?: string | null
  qrIdentityMetadata?: Record<string, unknown> | null
}): Promise<PassportQrResult> {
  const admin = createAdminClient()
  const issuedAt = new Date().toISOString()
  const { token } = issueQrToken()
  const pathname = `/scan/${input.passportId}`
  const sig = signQrPath(pathname, issuedAt)
  const publicPageUrl = `${baseUrl()}${pathname}?qt=${token}&ts=${encodeURIComponent(issuedAt)}&sig=${sig}`

  const { data: passport } = await admin
    .from("passports")
    .select("product_id")
    .eq("id", input.passportId)
    .maybeSingle()

  const { data: existingRows, error: selErr } = await admin
    .from("qr_codes")
    .select("*")
    .eq("passport_id", input.passportId)
    .order("created_at", { ascending: true })
    .limit(1)

  if (selErr) {
    console.warn("qr_codes lookup:", selErr.message)
  }

  const existing = existingRows?.[0] as Record<string, unknown> | undefined
  if (existing?.id) {
    const url = pickPublicUrl(existing, publicPageUrl)
    const imagePublicUrl = pickImageUrl(existing, url)
    const imageDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 })
    return {
      publicPageUrl: url,
      imageDataUrl,
      imagePublicUrl,
      qrCodeRowId: String(existing.id),
      qrIdentityId: undefined,
    }
  }

  return mintSinglePassportQrIdentity({
    passportId: input.passportId,
    organizationId: input.organizationId,
    productId: (passport?.product_id as string | null) ?? null,
    qrIdentityDisplayName: input.qrIdentityDisplayName,
    qrIdentityMetadata: input.qrIdentityMetadata,
  })
}
