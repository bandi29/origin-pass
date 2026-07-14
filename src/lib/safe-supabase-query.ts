import type { PostgrestError } from "@supabase/supabase-js"

export type SafeQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

type SupabaseQueryResponse<T> = {
  data: T | null
  error: PostgrestError | null
}

/**
 * Wrap a Supabase query so connection/query failures return a clean error object
 * instead of throwing or hanging the serverless handler.
 */
export async function safeSupabaseQuery<T>(
  label: string,
  run: () => PromiseLike<SupabaseQueryResponse<T>>,
): Promise<SafeQueryResult<T>> {
  try {
    const { data, error } = await run()
    if (error) {
      console.error(`[supabase:${label}]`, error.message)
      return { ok: false, error: error.message, code: error.code }
    }
    if (data === null) {
      return { ok: false, error: "No data returned." }
    }
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[supabase:${label}] unexpected`, message)
    return { ok: false, error: message }
  }
}

/** Like safeSupabaseQuery but allows null data (maybeSingle). */
export async function safeSupabaseQueryNullable<T>(
  label: string,
  run: () => PromiseLike<SupabaseQueryResponse<T>>,
): Promise<SafeQueryResult<T | null>> {
  try {
    const { data, error } = await run()
    if (error) {
      console.error(`[supabase:${label}]`, error.message)
      return { ok: false, error: error.message, code: error.code }
    }
    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[supabase:${label}] unexpected`, message)
    return { ok: false, error: message }
  }
}
