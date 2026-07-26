import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { logSupabaseHostInDev } from "@/lib/supabase/log-env"

/**
 * Server-side Supabase client (service-role).
 *
 * Use ONLY in server code: Route Handlers, Server Actions, Server Components.
 * Never import this into a `"use client"` file — the service-role key bypasses
 * RLS and must never reach the browser.
 *
 * The Shopify integration writes the offline access token to `organizations`
 * (our "stores" table), which is service-role-only by design — hence this client.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    )
  }

  logSupabaseHostInDev()

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
