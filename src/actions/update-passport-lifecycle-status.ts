"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import { invalidatePassportCache } from "@/lib/passport-public-cache"
import { writeAudit } from "@/lib/counterfeit-alerts-server"
import { getUserRole, canManageCounterfeitInvestigations } from "@/lib/rbac"
import {
  isPassportLifecycleAction,
  isPassportLifecycleReason,
  lifecycleConfirmKeywordMatches,
  passportLifecycleActionBlocked,
  PASSPORT_LIFECYCLE_ACTION_LABELS,
  PASSPORT_LIFECYCLE_REASONS,
  PASSPORT_LIFECYCLE_TARGET_STATUS,
  type PassportLifecycleAction,
} from "@/lib/passport-lifecycle-management"

export type UpdatePassportLifecycleStatusInput = {
  passportId: string
  action: PassportLifecycleAction
  reason: string
  note?: string
  confirmKeyword: string
}

export type UpdatePassportLifecycleStatusResult =
  | {
      success: true
      status: string
      lifecycleAction: PassportLifecycleAction
    }
  | {
      success: false
      error: string
    }

export async function updatePassportLifecycleStatus(
  input: UpdatePassportLifecycleStatusInput,
): Promise<UpdatePassportLifecycleStatusResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const role = await getUserRole(supabase, user.id)
  if (!canManageCounterfeitInvestigations(role)) {
    return { success: false, error: "You do not have permission to manage passport lifecycle." }
  }

  const passportId = input.passportId?.trim()
  if (!passportId) {
    return { success: false, error: "Passport id is required." }
  }

  if (!isPassportLifecycleAction(input.action)) {
    return { success: false, error: "Invalid lifecycle action." }
  }

  if (!isPassportLifecycleReason(input.reason)) {
    return { success: false, error: "A valid reason is required." }
  }

  if (!lifecycleConfirmKeywordMatches(input.action, input.confirmKeyword)) {
    return { success: false, error: "Confirmation keyword does not match the selected action." }
  }

  const inScope = await isPassportInScope(user.id, passportId)
  if (!inScope) {
    return { success: false, error: "Passport not found." }
  }

  const admin = createAdminClient()
  const { data: passport, error: loadError } = await admin
    .from("passports")
    .select("id, status, product_id, serial_number, passport_uid, metadata")
    .eq("id", passportId)
    .maybeSingle()

  if (loadError || !passport) {
    return { success: false, error: "Passport not found." }
  }

  const currentStatus = String(passport.status ?? "active")
  const blocked = passportLifecycleActionBlocked(input.action, currentStatus)
  if (blocked) {
    return { success: false, error: blocked }
  }

  const nextStatus = PASSPORT_LIFECYCLE_TARGET_STATUS[input.action]
  const reasonLabel =
    PASSPORT_LIFECYCLE_REASONS.find((option) => option.value === input.reason)?.label ??
    input.reason
  const trimmedNote = input.note?.trim() ?? ""
  const existingMetadata =
    passport.metadata && typeof passport.metadata === "object" && !Array.isArray(passport.metadata)
      ? (passport.metadata as Record<string, unknown>)
      : {}

  const { data: actorProfile } = await admin
    .from("users")
    .select("id, name, email, organization_id, role_v2, role")
    .eq("id", user.id)
    .maybeSingle()

  const lifecycleMetadata = {
    last_action: input.action,
    reason: input.reason,
    reason_label: reasonLabel,
    note: trimmedNote || null,
    previous_status: currentStatus,
    acted_at: new Date().toISOString(),
    acted_by: user.id,
    acted_by_name: actorProfile?.name?.trim() || null,
    acted_by_email: actorProfile?.email?.trim() || null,
    acted_by_role: actorProfile?.role_v2 ?? actorProfile?.role ?? null,
  }

  const nextMetadata = {
    ...existingMetadata,
    lifecycle_management: lifecycleMetadata,
  }

  const { error: updateError } = await admin
    .from("passports")
    .update({
      status: nextStatus,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", passportId)

  if (updateError) {
    console.error("updatePassportLifecycleStatus:", updateError.message)
    return { success: false, error: "Could not update passport status." }
  }

  await writeAudit(user.id, "passport_lifecycle_status_change", passportId, {
    passport_id: passportId,
    passport_uid: passport.passport_uid,
    serial_number: passport.serial_number,
    product_id: passport.product_id,
    action: input.action,
    action_label: PASSPORT_LIFECYCLE_ACTION_LABELS[input.action],
    reason: input.reason,
    reason_label: reasonLabel,
    note: trimmedNote || null,
    status_before: currentStatus,
    status_after: nextStatus,
    actor_user_id: user.id,
    actor_name: actorProfile?.name ?? null,
    actor_email: actorProfile?.email ?? null,
    actor_role: actorProfile?.role_v2 ?? actorProfile?.role ?? null,
    actor_organization_id: actorProfile?.organization_id ?? null,
  })

  await invalidatePassportCache(passportId)

  for (const locale of ["en", "fr", "it"]) {
    revalidatePath(`/${locale}/dashboard/product-identity/passports/${passportId}`)
  }

  return {
    success: true,
    status: nextStatus,
    lifecycleAction: input.action,
  }
}
