import QRCode from "qrcode"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "passport-qr"

export type PassportQrResult = {
  publicPageUrl: string
  imageDataUrl: string
  imagePublicUrl: string
  qrCodeRowId: string
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
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

/**
 * Idempotent: returns existing qr_codes row for passport when present.
 * Generates PNG, uploads to storage, persists qr_codes (admin).
 */
export async function generateAndStorePassportQr(input: {
  passportId: string
  organizationId: string | null
}): Promise<PassportQrResult> {
  const admin = createAdminClient()
  const publicPageUrl = `${baseUrl()}/scan/${input.passportId}`

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
    }
  }

  await ensureBucket()

  const png = await QRCode.toBuffer(publicPageUrl, { type: "png", width: 320, margin: 2 })
  const path = `${input.passportId}.png`

  const { data: up, error: upError } = await admin.storage.from(BUCKET).upload(path, png, {
    contentType: "image/png",
    upsert: true,
  })

  if (upError) {
    throw new Error(upError.message || "QR image upload failed")
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(up?.path ?? path)
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
      Object.entries(payload).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>

    const { data: inserted, error } = await admin.from("qr_codes").insert(clean).select("id").single()
    if (!error && inserted?.id) {
      return {
        publicPageUrl,
        imageDataUrl,
        imagePublicUrl,
        qrCodeRowId: inserted.id as string,
      }
    }
    lastErr = error ? new Error(error.message) : lastErr
  }

  throw lastErr ?? new Error("Failed to save QR record")
}
