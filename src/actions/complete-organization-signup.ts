"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { userHasOrganization } from "@/lib/auth-org"

const orgNameSchema = z
  .string()
  .trim()
  .min(2, "Organization name must be at least 2 characters.")
  .max(200, "Organization name is too long.")

export type CompleteOrgResult = { success: true } | { success: false; error: string }

/**
 * Creates organization and links public.users (and profiles for legacy RLS).
 * Uses service role only after verifying the session user — never trust client for user id.
 */
export async function completeOrganizationSignup(
  organizationName: string
): Promise<CompleteOrgResult> {
  const parsed = orgNameSchema.safeParse(organizationName)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid name." }
  }

  const name = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, error: "You must be signed in to continue." }
  }

  const email = user.email?.trim()
  if (!email) {
    return {
      success: false,
      error: "Your account has no email. Add an email in your profile and try again.",
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false,
      error: "Server configuration error. Please contact support.",
    }
  }

  if (await userHasOrganization(user.id)) {
    return { success: true }
  }

  const admin = createAdminClient()

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name })
    .select("id")
    .single()

  if (orgError || !org) {
    console.warn("completeOrganizationSignup org insert:", orgError?.message)
    return {
      success: false,
      error: "Could not create your organization. Please try again.",
    }
  }

  const { error: userError } = await admin.from("users").upsert(
    {
      id: user.id,
      email,
      organization_id: org.id,
      role: "owner",
    },
    { onConflict: "id" }
  )

  if (userError) {
    console.warn("completeOrganizationSignup users upsert:", userError.message)
    await admin.from("organizations").delete().eq("id", org.id)
    return {
      success: false,
      error: "Could not link your account. Please try again.",
    }
  }

  await admin.from("profiles").upsert(
    {
      id: user.id,
      brand_name: name,
    },
    { onConflict: "id" }
  )

  return { success: true }
}
