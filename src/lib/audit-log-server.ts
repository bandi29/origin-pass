import { createAdminClient } from "@/lib/supabase/admin"
import {
  getScopedOrgId,
  getScopedOrgScope,
  getScopedPassportIds,
  getScopedProductIds,
  NIL_UUID,
} from "@/backend/modules/organizations/scope"
import type { AuditLogEntry } from "@/lib/authenticity-intelligence"

export const VERIFICATION_AUDIT_ACTIONS = [
  "verification_orchestrator_run",
  "counterfeit_alert_assign",
  "counterfeit_alert_comment",
  "counterfeit_alert_resolved",
  "counterfeit_alert_confirm_fraud",
  "counterfeit_alert_escalate",
] as const

const TEAM_ACTION_LABELS: Record<string, string> = {
  member_invited: "Member invited",
  invitation_accepted: "Member joined team",
  invitation_revoked: "Invitation revoked",
  invitation_resent: "Invitation resent",
  role_changed: "Member role changed",
  member_suspended: "Member suspended",
  member_reactivated: "Member reactivated",
  member_removed: "Member removed",
  permission_update: "Role permissions updated",
  custom_role_created: "Custom role created",
  custom_role_deleted: "Custom role deleted",
  custom_role_duplicated: "Custom role duplicated",
  org_settings_updated: "Organization settings updated",
  suspicious_invite_accept_mismatch: "Suspicious invite acceptance",
}

const ALERT_AUDIT_LABELS: Record<string, string> = {
  counterfeit_alert_assign: "Alert assigned",
  counterfeit_alert_comment: "Alert commented",
  counterfeit_alert_resolved: "Alert resolved",
  counterfeit_alert_confirm_fraud: "Lifecycle suspended (fraud)",
  counterfeit_alert_escalate: "Alert escalated",
}

function shortId(value: string, prefix: string) {
  return `${prefix}-${String(value).replace(/-/g, "").slice(0, 12)}`
}

function mergeSortedByTimestamp(rows: AuditLogEntry[], limit: number): AuditLogEntry[] {
  return [...rows]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
}

async function fetchOrgMemberIds(userId: string): Promise<string[]> {
  const orgId = await getScopedOrgId(userId)
  if (!orgId) return [userId]

  const admin = createAdminClient()
  const { data } = await admin.from("users").select("id").eq("organization_id", orgId)
  const ids = (data ?? []).map((row) => row.id as string)
  return ids.length ? ids : [userId]
}

async function fetchUserLabels(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map()
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("id, name, email").in("id", userIds)
  const out = new Map<string, string>()
  for (const row of data ?? []) {
    const label = row.name?.trim() || row.email?.trim() || row.id
    out.set(row.id, label)
  }
  return out
}

function mapScanRow(
  r: {
    id: string
    scan_timestamp: string
    scan_result: string | null
    location_country: string | null
    location_city: string | null
    country?: string | null
    city?: string | null
    passports:
      | {
          product_id: string
          products:
            | { id: string; name: string | null }
            | { id: string; name: string | null }[]
            | null
        }
      | {
          product_id: string
          products:
            | { id: string; name: string | null }
            | { id: string; name: string | null }[]
            | null
        }[]
      | null
  },
): AuditLogEntry {
  const passport = Array.isArray(r.passports) ? r.passports[0] : r.passports
  const rawProd = passport?.products
  const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd
  const pid = prod?.id ?? passport?.product_id ?? "—"
  const city = (r.location_city ?? r.city ?? "").trim()
  const country = (r.location_country ?? r.country ?? "").trim()
  const location =
    city && country ? `${city}, ${country}` : country || city || "Not captured"
  const sr = r.scan_result ?? "valid"
  const action: AuditLogEntry["action"] =
    sr === "suspicious" ? "Flagged" : sr === "valid" ? "Scan" : "Verify"
  const result: AuditLogEntry["result"] =
    sr === "suspicious"
      ? "Suspicious"
      : sr === "invalid" || sr === "duplicate"
        ? "Failed"
        : "Success"
  const verdict: AuditLogEntry["verdict"] =
    sr === "suspicious"
      ? "suspicious"
      : sr === "invalid" || sr === "duplicate"
        ? "failed"
        : "valid"

  return {
    event_id: shortId(r.id, "AUD"),
    product_id: pid,
    product_name: prod?.name ?? null,
    action,
    result,
    verdict,
    location,
    timestamp: r.scan_timestamp,
    actor: "customer:scan",
    category: "scan",
  }
}

async function fetchVerificationScanRows(userId: string, limit: number): Promise<AuditLogEntry[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const admin = createAdminClient()

  const selectCore = `
      id,
      scan_timestamp,
      scan_result,
      location_country,
      location_city,
      passports!inner(
        product_id,
        products(id, name)
      )
    `

  const withLegacy = await admin
    .from("passport_scans")
    .select(
      `
      id,
      scan_timestamp,
      scan_result,
      location_country,
      location_city,
      country,
      city,
      passports!inner(
        product_id,
        products(id, name)
      )
    `,
    )
    .in("passport_id", ids)
    .order("scan_timestamp", { ascending: false })
    .limit(limit)

  let data: unknown[] | null = null
  let error: { message?: string } | null = null

  if (
    withLegacy.error &&
    /column|does not exist|42703/i.test(String(withLegacy.error.message ?? ""))
  ) {
    const fallback = await admin
      .from("passport_scans")
      .select(selectCore)
      .in("passport_id", ids)
      .order("scan_timestamp", { ascending: false })
      .limit(limit)
    data = fallback.data as unknown[] | null
    error = fallback.error
  } else {
    data = withLegacy.data as unknown[] | null
    error = withLegacy.error
  }

  if (error || !data?.length) return []
  return (data as Parameters<typeof mapScanRow>[0][]).map(mapScanRow)
}

async function fetchVerificationPassportRows(userId: string, limit: number): Promise<AuditLogEntry[]> {
  const productIds = await getScopedProductIds(userId)
  const scopedProductIds = productIds.length ? productIds : [NIL_UUID]
  const admin = createAdminClient()

  const { data } = await admin
    .from("passports")
    .select("id, serial_number, created_at, products(id, name)")
    .in("product_id", scopedProductIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => {
    const p = row as {
      id: string
      serial_number: string | null
      created_at: string
      products: { id: string; name: string | null } | { id: string; name: string | null }[] | null
    }
    const product = Array.isArray(p.products) ? p.products[0] : p.products
    const serial = p.serial_number?.trim()
    return {
      event_id: shortId(p.id, "PPT"),
      product_id: product?.id ?? "—",
      product_name: product?.name ?? null,
      action: "PassportCreated",
      result: "Success",
      verdict: "valid",
      location: serial ? `Serial ${serial}` : "Passport issued",
      timestamp: p.created_at,
      actor: "system:passport",
      category: "passport",
    }
  })
}

async function fetchVerificationAuditLogRows(userId: string, limit: number): Promise<AuditLogEntry[]> {
  const { productIds } = await getScopedOrgScope(userId)
  const scopedProductIds = new Set(productIds)
  const memberIds = await fetchOrgMemberIds(userId)
  const admin = createAdminClient()

  const { data: memberRows } = await admin
    .from("audit_logs")
    .select("id, user_id, action, resource, metadata, created_at")
    .in("user_id", memberIds)
    .in("action", [...VERIFICATION_AUDIT_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(limit)

  const { data: systemRows } = await admin
    .from("audit_logs")
    .select("id, user_id, action, resource, metadata, created_at")
    .is("user_id", null)
    .eq("action", "verification_orchestrator_run")
    .order("created_at", { ascending: false })
    .limit(limit)

  const rows = [...(memberRows ?? []), ...(systemRows ?? [])]
  const actorIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean) as string[])]
  const actorLabels = await fetchUserLabels(actorIds)

  const mapped: AuditLogEntry[] = []
  for (const row of rows) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {}
    const metaProductId =
      typeof metadata.product_id === "string" ? metadata.product_id : null
    if (metaProductId && scopedProductIds.size > 0 && !scopedProductIds.has(metaProductId)) {
      continue
    }

    const actionKey = String(row.action)
    const isOrchestrator = actionKey === "verification_orchestrator_run"
    const isFraudConfirm = actionKey === "counterfeit_alert_confirm_fraud"

    mapped.push({
      event_id: shortId(row.id, "LOG"),
      product_id: metaProductId ?? row.resource ?? "—",
      product_name:
        typeof metadata.product_name === "string" ? metadata.product_name : null,
      action: isOrchestrator ? "VerificationRun" : isFraudConfirm ? "LifecycleUpdated" : "AlertReview",
      result:
        isFraudConfirm || actionKey === "counterfeit_alert_escalate"
          ? "Suspicious"
          : actionKey === "counterfeit_alert_resolved"
            ? "Success"
            : "Info",
      verdict:
        isFraudConfirm || actionKey === "counterfeit_alert_escalate"
          ? "suspicious"
          : actionKey === "counterfeit_alert_resolved"
            ? "valid"
            : "neutral",
      location: isOrchestrator
        ? `Risk ${metadata.risk_before ?? "?"} → ${metadata.risk_after ?? "?"}`
        : ALERT_AUDIT_LABELS[actionKey] ?? "Verification review",
      timestamp: row.created_at,
      actor: row.user_id ? actorLabels.get(row.user_id) ?? "team:member" : "system:verification",
      category: isOrchestrator ? "verification" : isFraudConfirm ? "lifecycle" : "verification",
    })
  }

  return mapped
}

/** Product asset chain events: scans, passport issuance, verification reviews, lifecycle toggles. */
export async function getVerificationAuditLogForUser(
  userId: string,
  limit = 200,
): Promise<AuditLogEntry[]> {
  const perSource = Math.max(40, Math.ceil(limit / 3))
  const [scans, passports, auditRows] = await Promise.all([
    fetchVerificationScanRows(userId, perSource),
    fetchVerificationPassportRows(userId, perSource),
    fetchVerificationAuditLogRows(userId, perSource),
  ])

  return mergeSortedByTimestamp([...scans, ...passports, ...auditRows], limit)
}

async function fetchOperationsTeamRows(orgId: string, limit: number): Promise<AuditLogEntry[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("team_activity_logs")
    .select("id, actor_id, action, target_type, target_id, metadata, ip_address, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit)

  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter(Boolean) as string[])]
  const actorLabels = await fetchUserLabels(actorIds)

  return (data ?? []).map((row) => {
    const actionKey = String(row.action)
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {}
    const email =
      typeof metadata.email === "string"
        ? metadata.email
        : typeof metadata.invitee_email === "string"
          ? metadata.invitee_email
          : null

    return {
      event_id: shortId(row.id, "TEAM"),
      product_id: row.target_id ?? row.target_type ?? "organization",
      product_name: email ?? row.target_type ?? "Team",
      action: TEAM_ACTION_LABELS[actionKey] ?? actionKey.replace(/_/g, " "),
      result: actionKey.includes("suspicious") ? "Suspicious" : "Info",
      verdict: actionKey.includes("suspicious") ? "suspicious" : "neutral",
      location: row.ip_address ? `IP ${row.ip_address.slice(0, 12)}…` : "Admin console",
      timestamp: row.created_at,
      actor: row.actor_id ? actorLabels.get(row.actor_id) ?? "team:admin" : "system",
      category: "team",
    }
  })
}

async function fetchOperationsImportRows(
  orgId: string | null,
  userId: string,
  limit: number,
): Promise<AuditLogEntry[]> {
  const admin = createAdminClient()
  let query = admin
    .from("import_jobs")
    .select(
      "id, user_id, file_name, status, total_rows, success_count, failure_count, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (orgId) {
    query = query.eq("organization_id", orgId)
  } else {
    query = query.eq("user_id", userId)
  }

  const { data } = await query
  const actorIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean) as string[])]
  const actorLabels = await fetchUserLabels(actorIds)

  return (data ?? []).map((row) => {
    const status = String(row.status)
    const result: AuditLogEntry["result"] =
      status === "FAILED"
        ? "Failed"
        : status === "PARTIAL_SUCCESS"
          ? "Suspicious"
          : status === "COMPLETED"
            ? "Success"
            : "Info"
    const verdict: AuditLogEntry["verdict"] =
      status === "FAILED" ? "failed" : status === "PARTIAL_SUCCESS" ? "suspicious" : "neutral"

    return {
      event_id: shortId(row.id, "IMP"),
      product_id: row.id,
      product_name: row.file_name,
      action: "ImportBatch",
      result,
      verdict,
      location: `${row.success_count ?? 0}/${row.total_rows ?? 0} rows processed`,
      timestamp: row.updated_at ?? row.created_at,
      actor: actorLabels.get(row.user_id) ?? "team:member",
      category: "import",
    }
  })
}

/** Admin and system events: team activity, CSV import batches, org configuration. */
export async function getOperationsAuditLogForUser(
  userId: string,
  limit = 200,
): Promise<AuditLogEntry[]> {
  const orgId = await getScopedOrgId(userId)
  const perSource = Math.max(60, Math.ceil(limit / 2))

  const [teamRows, importRows] = await Promise.all([
    orgId ? fetchOperationsTeamRows(orgId, perSource) : Promise.resolve([]),
    fetchOperationsImportRows(orgId, userId, perSource),
  ])

  return mergeSortedByTimestamp([...teamRows, ...importRows], limit)
}

/** @deprecated Use getVerificationAuditLogForUser or getOperationsAuditLogForUser. */
export async function getAuditLogForUser(userId: string, limit = 200): Promise<AuditLogEntry[]> {
  return getVerificationAuditLogForUser(userId, limit)
}
