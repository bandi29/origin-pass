import { createAdminClient } from "@/lib/supabase/admin"

export async function getUserById(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.warn("getUserById error:", error.message)
    return null
  }
  return data
}
