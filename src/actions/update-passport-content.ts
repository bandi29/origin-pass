"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import { invalidatePassportCache } from "@/lib/passport-public-cache"

export type UpdatePassportContentInput = {
  passportId: string
  story: string
  materials: string
  origin: string
  lifecycle: string
}

export type UpdatePassportContentResult =
  | { success: true }
  | { success: false; error: string }

/** Field length caps — keep editorial content bounded without being restrictive. */
const LIMITS = {
  story: 5000,
  materials: 2000,
  origin: 300,
  lifecycle: 2000,
} as const

function clean(value: string, max: number): string | null {
  const trimmed = (value ?? "").trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/**
 * Updates the editorial content (story, materials, metadata) shown on a passport's
 * public verification page. Content lives on the product record, so this writes to
 * `products` after confirming the passport is in the caller's organization scope.
 */
export async function updatePassportContent(
  input: UpdatePassportContentInput,
): Promise<UpdatePassportContentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const passportId = input.passportId?.trim()
  if (!passportId) {
    return { success: false, error: "Passport id is required." }
  }

  const inScope = await isPassportInScope(user.id, passportId)
  if (!inScope) {
    return { success: false, error: "Passport not found." }
  }

  const admin = createAdminClient()
  const { data: passport, error: loadError } = await admin
    .from("passports")
    .select("id, product_id")
    .eq("id", passportId)
    .maybeSingle()

  if (loadError || !passport?.product_id) {
    return { success: false, error: "Passport not found." }
  }

  const { error: updateError } = await admin
    .from("products")
    .update({
      story: clean(input.story, LIMITS.story),
      materials: clean(input.materials, LIMITS.materials),
      origin: clean(input.origin, LIMITS.origin),
      lifecycle: clean(input.lifecycle, LIMITS.lifecycle),
      updated_at: new Date().toISOString(),
    })
    .eq("id", passport.product_id)

  if (updateError) {
    console.error("updatePassportContent:", updateError.message)
    return { success: false, error: "Could not save passport content." }
  }

  await invalidatePassportCache(passportId)

  for (const locale of ["en", "fr", "it"]) {
    revalidatePath(`/${locale}/dashboard/product-passports/${passportId}/edit`)
  }

  return { success: true }
}
