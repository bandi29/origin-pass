/**
 * Client-side direct upload to Supabase storage.
 * Bypasses Server Actions - no FormData serialization, no body size limit.
 * Uses the authenticated browser client - can be unit tested with mocked Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKET = "product-images"
const MAX_SIZE_MB = 10
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
const DEBUG_UPLOAD = process.env.NODE_ENV !== "production"

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File must be under ${MAX_SIZE_MB}MB`
  }
  const mime = file.type
  if (mime && !ALLOWED_TYPES.includes(mime)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed"
  }
  return null
}

export async function uploadProductImageClient(
  file: File,
  supabase: SupabaseClient
): Promise<UploadResult> {
  if (DEBUG_UPLOAD) {
    console.info("[ImageUpload] start", {
      name: file.name,
      type: file.type,
      size: file.size,
    })
  }

  const validationError = validateFile(file)
  if (validationError) {
    if (DEBUG_UPLOAD) {
      console.warn("[ImageUpload] validation_failed", { validationError })
    }
    return { success: false, error: validationError }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  let user = authData?.user ?? null
  if (DEBUG_UPLOAD) {
    console.info("[ImageUpload] getUser", {
      hasUser: !!user,
      authError: authError?.message ?? null,
    })
  }

  // Fallback: in some browser/session edge cases getUser can be null while
  // a valid local session still exists. Use it for upload continuity.
  if (!user) {
    const { data: sessionData } = await supabase.auth.getSession()
    user = sessionData?.session?.user ?? null
    if (DEBUG_UPLOAD) {
      console.info("[ImageUpload] getSession_fallback", { hasUser: !!user })
    }
  }

  if (authError || !user) {
    if (DEBUG_UPLOAD) {
      console.warn("[ImageUpload] unauthorized", {
        authError: authError?.message ?? null,
      })
    }
    return { success: false, error: "Unauthorized. Please sign in again and retry upload." }
  }

  const ext = file.name.split(".").pop() || (file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg")
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  const path = `${user.id}/${Date.now()}-${randomPart}.${ext}`
  if (DEBUG_UPLOAD) {
    console.info("[ImageUpload] upload_path_ready", { bucket: BUCKET, path })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false })

  if (error || !data?.path) {
    if (DEBUG_UPLOAD) {
      console.error("[ImageUpload] storage_upload_failed", {
        message: error?.message ?? "unknown",
      })
    }
    return { success: false, error: error?.message ?? "Upload failed while writing to storage" }
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  if (DEBUG_UPLOAD) {
    console.info("[ImageUpload] success", { publicUrl: urlData.publicUrl })
  }
  return { success: true, url: urlData.publicUrl }
}
