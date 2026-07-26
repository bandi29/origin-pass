let logged = false

/**
 * One-shot, non-sensitive host log outside Vercel Production.
 * Never logs keys — only hostname + env label.
 *
 * Note: Vercel Preview builds use NODE_ENV=production, so we key off
 * VERCEL_ENV when present (development | preview | production).
 */
export function logSupabaseHostInDev(): void {
  if (logged) return

  const envLabel = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown"
  if (envLabel === "production") return

  logged = true

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    console.info(`[DB Config] Connected to: (unset) (Env: ${envLabel})`)
    return
  }

  try {
    console.info(`[DB Config] Connected to: ${new URL(url).host} (Env: ${envLabel})`)
  } catch {
    console.info(`[DB Config] Connected to: (invalid URL) (Env: ${envLabel})`)
  }
}
