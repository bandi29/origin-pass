import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import {
  PASSPORT_VERIFICATION_EVENT_LABELS,
  type PassportVerificationComplianceStatus,
  type PassportVerificationEventType,
  type PassportVerificationHistoryEntry,
} from "@/lib/passport-verification-management"

type HistoryRow = {
  id: string
  passport_id: string
  event_type: string
  determined_status: string
  performed_by_label: string | null
  notes: string | null
  created_at: string
}

function mapHistoryRow(row: HistoryRow): PassportVerificationHistoryEntry {
  const eventType = row.event_type as PassportVerificationEventType
  return {
    id: row.id,
    passportId: row.passport_id,
    eventType,
    eventLabel:
      PASSPORT_VERIFICATION_EVENT_LABELS[eventType] ??
      eventType.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    determinedStatus: row.determined_status as PassportVerificationComplianceStatus,
    performedBy: row.performed_by_label?.trim() || "System Engine AI Agent",
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export type PassportVerificationPanelPayload = {
  complianceStatus: PassportVerificationComplianceStatus
  history: PassportVerificationHistoryEntry[]
}

const DEFAULT_PAYLOAD: PassportVerificationPanelPayload = {
  complianceStatus: "verified",
  history: [],
}

export async function getPassportVerificationPanelPayload(
  userId: string,
  passportId: string,
): Promise<PassportVerificationPanelPayload> {
  const inScope = await isPassportInScope(userId, passportId)
  if (!inScope) return DEFAULT_PAYLOAD

  const admin = createAdminClient()

  const { data: passport, error: passportError } = await admin
    .from("passports")
    .select("verification_compliance_status")
    .eq("id", passportId)
    .maybeSingle()

  if (passportError) {
    if (/passport_verification_history|verification_compliance_status|does not exist|42703/i.test(passportError.message)) {
      return DEFAULT_PAYLOAD
    }
    console.warn("getPassportVerificationPanelPayload passport:", passportError.message)
  }

  const complianceStatus =
    (passport?.verification_compliance_status as PassportVerificationComplianceStatus | undefined) ??
    "verified"

  const { data: historyRows, error: historyError } = await admin
    .from("passport_verification_history")
    .select(
      "id, passport_id, event_type, determined_status, performed_by_label, notes, created_at",
    )
    .eq("passport_id", passportId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (historyError) {
    if (/passport_verification_history|does not exist|42703/i.test(historyError.message)) {
      return { complianceStatus, history: [] }
    }
    console.warn("getPassportVerificationPanelPayload history:", historyError.message)
    return { complianceStatus, history: [] }
  }

  return {
    complianceStatus,
    history: ((historyRows ?? []) as HistoryRow[]).map(mapHistoryRow),
  }
}
