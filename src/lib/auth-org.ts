import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Returns whether the authenticated user has completed org setup (public.users row with organization_id).
 */
export async function userHasOrganization(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data?.organization_id) return false
  return true
}
