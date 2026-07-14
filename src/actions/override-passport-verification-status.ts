"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import { writeAudit } from "@/lib/counterfeit-alerts-server"
import { getUserRole, canManageCounterfeitInvestigations } from "@/lib/rbac"
import {
  isPassportVerificationComplianceStatus,
  PASSPORT_VERIFICATION_EVENT_LABELS,
  PASSPORT_VERIFICATION_STATUS_LABELS,
  type PassportVerificationComplianceStatus,
  type PassportVerificationHistoryEntry,
} from "@/lib/passport-verification-management"

export type OverridePassportVerificationStatusInput = {
  passportId: string
  targetStatus: PassportVerificationComplianceStatus
  justification: string
}

export type OverridePassportVerificationStatusResult =
  | {
      success: true
      complianceStatus: PassportVerificationComplianceStatus
      entry: PassportVerificationHistoryEntry
    }
  | {
      success: false
      error: string
    }

export async function overridePassportVerificationStatus(
  input: OverridePassportVerificationStatusInput,
): Promise<OverridePassportVerificationStatusResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const role = await getUserRole(supabase, user.id)
  if (!canManageCounterfeitInvestigations(role)) {
    return { success: false, error: "You do not have permission to override verification status." }
  }

  const passportId = input.passportId?.trim()
  if (!passportId) {
    return { success: false, error: "Passport id is required." }
  }

  if (!isPassportVerificationComplianceStatus(input.targetStatus)) {
    return { success: false, error: "Select a valid target compliance status." }
  }

  const justification = input.justification?.trim() ?? ""
  if (justification.length < 8) {
    return { success: false, error: "Justification must be at least 8 characters." }
  }

  const inScope = await isPassportInScope(user.id, passportId)
  if (!inScope) {
    return { success: false, error: "Passport not found." }
  }

  const admin = createAdminClient()
  const { data: passport, error: loadError } = await admin
    .from("passports")
    .select("id, passport_uid, serial_number, product_id, organization_id, verification_compliance_status")
    .eq("id", passportId)
    .maybeSingle()

  if (loadError || !passport) {
    return { success: false, error: "Passport not found." }
  }

  const { data: actorProfile } = await admin
    .from("users")
    .select("id, name, email, organization_id, role_v2, role")
    .eq("id", user.id)
    .maybeSingle()

  const performedByLabel =
    actorProfile?.email?.trim() ||
    actorProfile?.name?.trim() ||
    user.email?.trim() ||
    user.id

  const organizationId =
    (passport.organization_id as string | null) ??
    (actorProfile?.organization_id as string | null) ??
    null

  const previousStatus =
    (passport.verification_compliance_status as PassportVerificationComplianceStatus | undefined) ??
    "verified"

  const { data: inserted, error: insertError } = await admin
    .from("passport_verification_history")
    .insert({
      passport_id: passportId,
      organization_id: organizationId,
      event_type: "manual_override",
      determined_status: input.targetStatus,
      performed_by_user_id: user.id,
      performed_by_label: performedByLabel,
      notes: justification,
      metadata: {
        previous_status: previousStatus,
        actor_user_id: user.id,
        actor_name: actorProfile?.name ?? null,
        actor_email: actorProfile?.email ?? user.email ?? null,
        actor_role: actorProfile?.role_v2 ?? actorProfile?.role ?? null,
      },
    })
    .select(
      "id, passport_id, event_type, determined_status, performed_by_label, notes, created_at",
    )
    .single()

  if (insertError || !inserted) {
    console.error("overridePassportVerificationStatus insert:", insertError?.message)
    return { success: false, error: "Could not record verification override." }
  }

  const { error: updateError } = await admin
    .from("passports")
    .update({
      verification_compliance_status: input.targetStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", passportId)

  if (updateError) {
    console.error("overridePassportVerificationStatus update:", updateError.message)
    return { success: false, error: "Could not update passport verification status." }
  }

  await writeAudit(user.id, "passport_verification_manual_override", passportId, {
    passport_id: passportId,
    passport_uid: passport.passport_uid,
    serial_number: passport.serial_number,
    product_id: passport.product_id,
    event_type: "manual_override",
    event_label: PASSPORT_VERIFICATION_EVENT_LABELS.manual_override,
    status_before: previousStatus,
    status_after: input.targetStatus,
    status_label: PASSPORT_VERIFICATION_STATUS_LABELS[input.targetStatus],
    notes: justification,
    actor_user_id: user.id,
    actor_name: actorProfile?.name ?? null,
    actor_email: actorProfile?.email ?? user.email ?? null,
    actor_role: actorProfile?.role_v2 ?? actorProfile?.role ?? null,
    actor_organization_id: organizationId,
  })

  for (const locale of ["en", "fr", "it"]) {
    revalidatePath(`/${locale}/dashboard/product-identity/passports/${passportId}`)
  }

  const entry: PassportVerificationHistoryEntry = {
    id: inserted.id,
    passportId: inserted.passport_id,
    eventType: "manual_override",
    eventLabel: PASSPORT_VERIFICATION_EVENT_LABELS.manual_override,
    determinedStatus: inserted.determined_status as PassportVerificationComplianceStatus,
    performedBy: inserted.performed_by_label?.trim() || performedByLabel,
    notes: inserted.notes,
    createdAt: inserted.created_at,
  }

  return {
    success: true,
    complianceStatus: input.targetStatus,
    entry,
  }
}
