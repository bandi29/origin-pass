import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { userHasOrganization } from "@/lib/auth-org"

type RequireAuthOptions = {
  /** If true, send users without an organization to finish signup */
  requireOrganization?: boolean
}

/**
 * Server-side guard for App Router layouts/pages.
 */
export async function requireAuth(options: RequireAuthOptions = {}) {
  const { requireOrganization = true } = options
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (requireOrganization && !(await userHasOrganization(user.id))) {
    redirect("/signup/complete")
  }

  return { user }
}
