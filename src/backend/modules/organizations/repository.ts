import { createAdminClient } from "@/lib/supabase/admin"

export async function getOrganizationById(organizationId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    console.warn("getOrganizationById error:", error.message)
    return null
  }
  return data
}
