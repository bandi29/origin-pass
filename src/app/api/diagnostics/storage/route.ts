/**
 * Diagnostic API for Supabase storage setup.
 * GET /api/diagnostics/storage
 *
 * Only enabled when NODE_ENV=development or DIAGNOSTICS_ENABLED=1
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "product-images"
const DESIRED_FILE_SIZE_LIMIT = 10 * 1024 * 1024

export async function GET() {
  const isDev = process.env.NODE_ENV === "development"
  const diagnosticsEnabled = process.env.DIAGNOSTICS_ENABLED === "1"
  if (!isDev && !diagnosticsEnabled) {
    return NextResponse.json(
      { error: "Diagnostics disabled in production" },
      { status: 403 }
    )
  }

  const checks: Record<string, { ok: boolean; message: string }> = {}
  let overallOk = true

  // 1. Env vars
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  checks.env = {
    ok: hasUrl && hasAnonKey && hasServiceKey,
    message: hasUrl && hasAnonKey && hasServiceKey
      ? "All Supabase env vars set"
      : `Missing: ${[
          !hasUrl && "NEXT_PUBLIC_SUPABASE_URL",
          !hasAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          !hasServiceKey && "SUPABASE_SERVICE_ROLE_KEY",
        ]
          .filter(Boolean)
          .join(", ")}`,
  }
  if (!checks.env.ok) overallOk = false

  if (!hasUrl || !hasServiceKey) {
    return NextResponse.json({
      ok: false,
      message: "Cannot run storage checks without Supabase credentials",
      checks,
    })
  }

  try {
    const admin = createAdminClient()

    // 2. List buckets
    const { data: buckets, error: listError } = await admin.storage.listBuckets()
    checks.listBuckets = {
      ok: !listError,
      message: listError ? `Failed: ${listError.message}` : "Can list buckets",
    }
    if (listError) overallOk = false

    // 3. product-images bucket exists
    const bucket = buckets?.find((b) => b.name === BUCKET)
    const bucketExists = !!bucket
    checks.bucketExists = {
      ok: bucketExists,
      message: bucketExists
        ? `Bucket "${BUCKET}" exists`
        : `Bucket "${BUCKET}" not found. Run migration or create manually.`,
    }
    if (!bucketExists) overallOk = false

    // 4. Try to create bucket if missing (idempotent)
    if (!bucketExists) {
      const { error: createError } = await admin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: DESIRED_FILE_SIZE_LIMIT,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      })
      const created = !createError || createError.message?.includes("already exists")
      checks.bucketCreateAttempt = {
        ok: created,
        message: created
          ? "Bucket created or already exists"
          : `Create failed: ${createError?.message}`,
      }
      if (created) overallOk = true
    }

    // 5. Ensure bucket file size limit is updated (existing buckets keep old limit)
    if (bucketExists) {
      const currentLimit = Number((bucket as { file_size_limit?: number; fileSizeLimit?: number }).file_size_limit
        ?? (bucket as { file_size_limit?: number; fileSizeLimit?: number }).fileSizeLimit
        ?? 0)
      const needsUpdate = !currentLimit || currentLimit < DESIRED_FILE_SIZE_LIMIT
      if (needsUpdate) {
        const { error: updateError } = await admin.storage.updateBucket(BUCKET, {
          public: true,
          fileSizeLimit: DESIRED_FILE_SIZE_LIMIT,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        })
        checks.bucketLimitUpdate = {
          ok: !updateError,
          message: updateError
            ? `Limit update failed: ${updateError.message}`
            : `Bucket file size limit updated to ${DESIRED_FILE_SIZE_LIMIT} bytes`,
        }
        if (updateError) overallOk = false
      } else {
        checks.bucketLimitUpdate = {
          ok: true,
          message: `Bucket file size limit already ${currentLimit} bytes`,
        }
      }
    }

    return NextResponse.json({
      ok: overallOk,
      message: overallOk
        ? "Storage setup looks good"
        : "See checks below for issues",
      checks,
      bucket: BUCKET,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: "Diagnostic failed",
      error: err instanceof Error ? err.message : String(err),
      checks,
    })
  }
}
