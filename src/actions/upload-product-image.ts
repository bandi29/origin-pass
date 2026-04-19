"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "product-images"
const MAX_SIZE_MB = 10
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]

export interface UploadProductImageResult {
  success: boolean
  url?: string
  error?: string
}

async function ensureBucketExists(): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set; bucket creation skipped (bucket may already exist)")
    return
  }
  const admin = createAdminClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) {
    console.error("Bucket list error:", listError)
    return
  }
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (!exists) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE_MB * 1024 * 1024,
      allowedMimeTypes: ALLOWED_TYPES,
    })
    if (error && !error.message?.includes("already exists")) {
      console.error("Bucket creation error:", error)
    }
  }
}

export async function uploadProductImage(formData: FormData): Promise<UploadProductImageResult> {
  try {
    const file = formData.get("file") as File | Blob | null
    if (!file || typeof file !== "object" || !("size" in file) || !("arrayBuffer" in file)) {
      return { success: false, error: "No file provided or file was truncated (try a smaller image or check body size limit)" }
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return { success: false, error: `File must be under ${MAX_SIZE_MB}MB` }
    }

    const mime = (file as File & { type?: string }).type
    if (mime && !ALLOWED_TYPES.includes(mime)) {
      return { success: false, error: "Only JPEG, PNG, WebP, and GIF images are allowed" }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    await ensureBucketExists()

    const fileName = (file as File & { name?: string }).name
    const ext = fileName?.split(".").pop() || (mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg")
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.error("Upload error:", error)
      return { success: false, error: error.message }
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    return { success: true, url: urlData.publicUrl }
  } catch (err) {
    console.error("Upload exception:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    }
  }
}
