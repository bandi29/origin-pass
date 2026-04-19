import { ingestDocumentImage } from "@/lib/ai-photo-passport"
import { mergeComplianceExtractions } from "@/lib/ingestion/compliance-ingestion-schema"
import type { ProductAiMetadata } from "@/lib/compliance/product-ai-metadata"
import { createClient } from "@/lib/supabase/server"
import { checkPhotoPassportRateLimit } from "@/lib/photo-passport-rate-limit"
import { ensureBrandProfile } from "@/lib/tenancy"

export const maxDuration = 60

const BUCKET = "product-images"
const MAX_BYTES_IMAGE = 4 * 1024 * 1024
const MAX_BYTES_PDF = 8 * 1024 * 1024
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
])
const MAX_FILES = 8

function collectImageFiles(form: FormData): File[] {
  const namedFile = form.getAll("file").filter((x): x is File => x instanceof File && x.size > 0)
  const namedFiles = form.getAll("files").filter((x): x is File => x instanceof File && x.size > 0)
  const list = namedFile.length > 0 ? namedFile : namedFiles
  return list.slice(0, MAX_FILES)
}

function maxBytesForMime(mime: string): number {
  return mime === "application/pdf" ? MAX_BYTES_PDF : MAX_BYTES_IMAGE
}

function sourceObjectPath(userId: string, file: File): string {
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "source"
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${userId}/compliance-ai/${Date.now()}-${id}-${safe}`
}

async function uploadSourcesToStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  files: File[],
): Promise<ProductAiMetadata["source_files"]> {
  const out: NonNullable<ProductAiMetadata["source_files"]> = []
  for (const file of files) {
    const path = sourceObjectPath(userId, file)
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    })
    if (error || !data?.path) {
      console.error("photo-to-passport storage upload:", error?.message ?? "unknown")
      continue
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    out.push({
      url: pub.publicUrl,
      mime_type: file.type || "application/octet-stream",
      original_name: file.name,
    })
  }
  return out.length ? out : undefined
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!checkPhotoPassportRateLimit(user.id).ok) {
    return Response.json(
      { error: "Too many photo imports this hour. Try again later." },
      { status: 429 },
    )
  }

  await ensureBrandProfile(supabase, user)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  const files = collectImageFiles(form)
  if (files.length === 0) {
    return Response.json({ error: "Add at least one file." }, { status: 400 })
  }

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return Response.json(
        { error: "Use JPEG, PNG, WebP, GIF, or PDF." },
        { status: 400 },
      )
    }
    const cap = maxBytesForMime(file.type)
    if (file.size > cap) {
      return Response.json(
        {
          error:
            file.type === "application/pdf"
              ? "Each PDF must be 8MB or smaller."
              : "Each image must be 4MB or smaller.",
        },
        { status: 400 },
      )
    }
  }

  try {
    const runs = await Promise.all(
      files.map(async (file) => {
        const buf = Buffer.from(await file.arrayBuffer())
        const base64 = buf.toString("base64")
        return ingestDocumentImage({
          base64,
          mimeType: file.type || "application/octet-stream",
        })
      }),
    )

    const extractions = runs.map((r) => r.result)
    const provider = runs[0]?.provider ?? "gemini"
    const merged = mergeComplianceExtractions(extractions)
    const { aiFilledKeys, ...extraction } = merged

    const source_files = await uploadSourcesToStorage(supabase, user.id, files)

    const aiMetadata: ProductAiMetadata = {
      extraction_confidence: extraction.confidence,
      ...(typeof extraction.confidenceScore === "number"
        ? { extraction_confidence_score: extraction.confidenceScore }
        : {}),
      provider,
      extracted_at: new Date().toISOString(),
      source_files,
      files_processed: files.length,
    }

    return Response.json({
      extraction,
      aiFilledKeys,
      provider,
      filesProcessed: files.length,
      aiMetadata,
    })
  } catch (e) {
    console.error("photo-to-passport:", e)
    const msg = e instanceof Error ? e.message : "Extraction failed"
    if (msg.includes("PDF_DOCUMENTS_REQUIRE_GEMINI")) {
      return Response.json(
        {
          error:
            "PDF requires Gemini. Set GEMINI_API_KEY on the server (OpenAI accepts images only).",
        },
        { status: 400 },
      )
    }
    if (
      msg.includes("GEMINI_API_KEY") ||
      msg.includes("GOOGLE_AI_API_KEY") ||
      msg.includes("OPENAI_API_KEY") ||
      msg.includes("No AI vision provider")
    ) {
      return Response.json(
        {
          error:
            "AI vision is not configured. Set GEMINI_API_KEY (Gemini 1.5 Flash) or OPENAI_API_KEY on the server.",
        },
        { status: 503 },
      )
    }
    return Response.json(
      { error: "Could not read this file. Try a clearer scan or different format." },
      { status: 500 },
    )
  }
}
