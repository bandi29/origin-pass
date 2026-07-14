import { createAdminClient } from "@/lib/supabase/admin"
import {
  getScopedPassportIds,
  NIL_UUID,
} from "@/backend/modules/organizations/scope"
import { approxCoordsFromLocation } from "@/lib/geo-approx"
import type {
  ConfidenceBreakdown,
  CounterfeitAlertPriority,
  CounterfeitAlertSeverity,
  CounterfeitAlertStatus,
  CounterfeitIssueType,
  CounterfeitTriggerSource,
  InvestigationAlertDetail,
  InvestigationAlertRow,
  InvestigationComment,
  InvestigationEvidenceItem,
  InvestigationMapPoint,
  InvestigationSummary,
  InvestigationTimelineEntry,
  StatusHistoryEntry,
} from "@/lib/counterfeit-alerts-types"
import {
  clampRisk,
  computeAlertConfidence,
  deltaForIssue,
  RISK_DELTA,
} from "@/lib/counterfeit-alerts-risk"

function boundsLastDays(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

async function getUserOrgId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()
  return (data?.organization_id as string | null | undefined) ?? null
}

export function counterfeitAlertsOrFilter(userId: string, orgId: string | null): string {
  if (orgId) {
    return `brand_id.eq.${userId},organization_id.eq.${orgId}`
  }
  return `brand_id.eq.${userId}`
}

function slaDueIso(priority: CounterfeitAlertPriority, from: Date): string {
  const hours: Record<CounterfeitAlertPriority, number> = {
    critical: 4,
    high: 24,
    medium: 72,
    low: 168,
  }
  const h = hours[priority] ?? 72
  return new Date(from.getTime() + h * 3600 * 1000).toISOString()
}

function mapScanResultToIssue(scanResult: string | null): CounterfeitIssueType {
  switch (scanResult) {
    case "duplicate":
      return "duplicate_scans"
    case "invalid":
      return "invalid_qr"
    default:
      return "location_mismatch"
  }
}

function mapScanToSeverity(
  scanResult: string | null,
  risk: number | null,
): CounterfeitAlertSeverity {
  const r = risk ?? 0
  if (scanResult === "invalid") return r >= 70 ? "critical" : "high"
  if (scanResult === "duplicate") return r >= 55 ? "high" : "medium"
  return r >= 50 ? "high" : "medium"
}

function severityToPriority(sev: CounterfeitAlertSeverity): CounterfeitAlertPriority {
  if (sev === "critical") return "critical"
  if (sev === "high") return "high"
  if (sev === "medium") return "medium"
  return "low"
}

function readSku(baseData: unknown): string | null {
  if (!baseData || typeof baseData !== "object") return null
  const sku = (baseData as Record<string, unknown>).sku
  return typeof sku === "string" && sku.trim() ? sku.trim() : null
}

type DbAlert = Record<string, unknown> & {
  id: string
  investigation_ref: string
  product_id: string
  passport_id: string | null
  qr_identity_id: string | null
  issue_type: CounterfeitIssueType
  severity: CounterfeitAlertSeverity
  priority: CounterfeitAlertPriority
  status: CounterfeitAlertStatus
  confidence_score: number
  risk_score_snapshot: number
  trigger_source: CounterfeitTriggerSource
  region: string | null
  scan_count: number
  last_scan_at: string | null
  assigned_to: string | null
  sla_due_at: string | null
  created_at: string
  source_rule_id: string | null
  evidence_snapshot?: Record<string, unknown>
  event_metadata?: Record<string, unknown>
  investigation_notes?: string | null
  resolution_type?: string | null
  resolution_notes?: string | null
  resolved_at?: string | null
  resolved_by?: string | null
  products?: ProductJoin | ProductJoin[] | null
  passports?: PassportJoin | PassportJoin[] | null
}

type ProductJoin = {
  id: string
  brand_id: string
  organization_id: string | null
  name: string | null
  batch_id: string | null
  risk_score: number | null
  verification_status: string | null
  qr_identity_id: string | null
  base_data: unknown
}

type PassportJoin = {
  id: string
  serial_number: string | null
  status: string | null
}

function first<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  return Array.isArray(x) ? (x[0] ?? null) : x
}

function toRow(
  row: DbAlert,
  assigneeMap: Map<string, string>,
  qrCodes: Map<string, string | null>,
): InvestigationAlertRow {
  const prod = first(row.products)
  const pass = first(row.passports)
  const qid = row.qr_identity_id ?? prod?.qr_identity_id ?? null
  const now = Date.now()
  const sla = row.sla_due_at ? new Date(row.sla_due_at).getTime() : null
  const open = !["resolved", "archived", "false_positive"].includes(row.status)
  const isOverdue = Boolean(sla && open && sla < now)
  const isCriticalOpen = open && row.priority === "critical"

  return {
    id: row.id,
    investigation_ref: row.investigation_ref,
    product_id: row.product_id,
    product_name: prod?.name ?? "Unknown product",
    sku: readSku(prod?.base_data ?? null),
    batch: prod?.batch_id ?? null,
    passport_id: row.passport_id,
    passport_serial: pass?.serial_number ?? null,
    qr_identity_id: qid,
    qr_code: qid ? qrCodes.get(qid) ?? null : null,
    issue_type: row.issue_type,
    severity: row.severity,
    priority: row.priority,
    status: row.status,
    confidence_score: row.confidence_score,
    risk_score_snapshot: row.risk_score_snapshot,
    product_risk_score: prod?.risk_score ?? null,
    verification_status: prod?.verification_status ?? null,
    region: row.region,
    last_scan_at: row.last_scan_at,
    scan_count: row.scan_count,
    trigger_source: row.trigger_source,
    assigned_to: row.assigned_to,
    assignee_label: row.assigned_to
      ? assigneeMap.get(row.assigned_to) ?? row.assigned_to.slice(0, 8)
      : null,
    sla_due_at: row.sla_due_at,
    created_at: row.created_at,
    source_rule_id: row.source_rule_id,
    is_overdue: isOverdue,
    is_critical_open: isCriticalOpen,
  }
}

async function loadQrCodes(ids: string[]): Promise<Map<string, string | null>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, string | null>()
  if (!uniq.length) return map
  const admin = createAdminClient()
  const { data } = await admin.from("qr_identities").select("id, qr_code").in("id", uniq)
  for (const r of data ?? []) {
    const row = r as { id: string; qr_code: string | null }
    map.set(row.id, row.qr_code ?? null)
  }
  return map
}

async function loadAssigneeLabels(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, string>()
  if (!uniq.length) return map
  const admin = createAdminClient()
  const { data } = await admin
    .from("users")
    .select("id, name, email")
    .in("id", uniq)
  for (const u of data ?? []) {
    const row = u as { id: string; name: string | null; email: string | null }
    const label =
      (row.name && row.name.trim()) ||
      (row.email && row.email.trim()) ||
      row.id.slice(0, 8)
    map.set(row.id, label)
  }
  return map
}

/** Upserts investigation rows from non-valid passport scans (never auto-resolves). */
export async function syncCounterfeitAlertsFromScans(userId: string): Promise<number> {
  const passportIds = await getScopedPassportIds(userId)
  if (!passportIds.length) return 0
  const { start, end } = boundsLastDays(90)
  const admin = createAdminClient()

  const { data: scans, error } = await admin
    .from("passport_scans")
    .select(
      `
      id,
      scan_timestamp,
      scan_result,
      risk_score,
      location_country,
      location_city,
      device_type,
      ip_address,
      passport_id,
      passports!inner(
        id,
        serial_number,
        product_id,
        status,
        products!inner(
          id,
          name,
          brand_id,
          organization_id,
          batch_id,
          risk_score,
          verification_status,
          qr_identity_id,
          base_data
        )
      )
    `,
    )
    .in("passport_id", passportIds.length ? passportIds : [NIL_UUID])
    .neq("scan_result", "valid")
    .gte("scan_timestamp", start)
    .lte("scan_timestamp", end)
    .order("scan_timestamp", { ascending: false })
    .limit(150)

  if (error || !scans?.length) return 0

  type ScanRow = {
    id: string
    scan_timestamp: string
    scan_result: string | null
    risk_score: number | null
    location_country: string | null
    location_city: string | null
    device_type: string | null
    ip_address: string | null
    passport_id: string
    passports:
      | {
          id: string
          serial_number: string
          product_id: string
          status: string | null
          products: ProductJoin | ProductJoin[]
        }
      | {
          id: string
          serial_number: string
          product_id: string
          status: string | null
          products: ProductJoin | ProductJoin[]
        }[]
  }

  const scanList = scans as unknown as ScanRow[]

  let inserted = 0
  const pids = [...new Set(scanList.map((s) => s.passport_id))]
  const { data: scanAgg } = await admin
    .from("passport_scans")
    .select("passport_id, scan_timestamp")
    .in("passport_id", pids)

  const byPassport: Record<string, { count: number; last: string | null }> = {}
  for (const sid of pids) {
    byPassport[sid] = { count: 0, last: null }
  }
  for (const r of scanAgg ?? []) {
    const row = r as { passport_id: string; scan_timestamp: string }
    const b = byPassport[row.passport_id]
    if (!b) continue
    b.count += 1
    if (!b.last || row.scan_timestamp > b.last) b.last = row.scan_timestamp
  }

  const scanIds = scanList.map((s) => s.id)
  const { data: existingAlerts } = await admin
    .from("counterfeit_alerts")
    .select("passport_scan_id")
    .in("passport_scan_id", scanIds)
  const existingScans = new Set(
    (existingAlerts ?? [])
      .map((r) => (r as { passport_scan_id: string | null }).passport_scan_id)
      .filter(Boolean) as string[],
  )

  for (const s of scanList) {
    if (existingScans.has(s.id)) continue

    const passSingle = Array.isArray(s.passports) ? s.passports[0] : s.passports
    if (!passSingle) continue
    const prodRaw = passSingle.products
    const prod = Array.isArray(prodRaw) ? prodRaw[0] : prodRaw
    if (!prod?.id) continue

    const issue = mapScanResultToIssue(s.scan_result)
    const severity = mapScanToSeverity(s.scan_result, s.risk_score)
    const priority = severityToPriority(severity)
    const riskSnap = clampRisk(Number(s.risk_score ?? prod.risk_score ?? 0))
    const { score: confidence, breakdown } = computeAlertConfidence({
      issue_type: issue,
      scan_count: byPassport[s.passport_id]?.count ?? 1,
      risk_score_snapshot: riskSnap,
      trigger_source: "passport_scan",
    })

    const city = (s.location_city ?? "").trim()
    const country = (s.location_country ?? "").trim()
    const region = country || city || null

    const evidenceSnapshot = {
      trigger_scan_id: s.id,
      scan_result: s.scan_result,
      location: city && country ? `${city}, ${country}` : region,
      device_type: s.device_type,
      ip_address: s.ip_address,
      confidence_breakdown: breakdown,
    }

    const createdAt = new Date(s.scan_timestamp)
    const sla = slaDueIso(priority, createdAt)

    const { data: alertRow, error: insErr } = await admin
      .from("counterfeit_alerts")
      .insert({
        brand_id: prod.brand_id,
        organization_id: prod.organization_id ?? null,
        product_id: prod.id,
        passport_id: s.passport_id,
        passport_scan_id: s.id,
        qr_identity_id: prod.qr_identity_id ?? null,
        issue_type: issue,
        severity,
        priority,
        status: "new" as CounterfeitAlertStatus,
        confidence_score: confidence,
        verification_confidence: null,
        risk_score_snapshot: riskSnap,
        trigger_source: "passport_scan" as CounterfeitTriggerSource,
        region,
        scan_count: byPassport[s.passport_id]?.count ?? 1,
        last_scan_at: byPassport[s.passport_id]?.last ?? s.scan_timestamp,
        sla_due_at: sla,
        evidence_snapshot: evidenceSnapshot,
        event_metadata: {
          passport_serial: passSingle.serial_number,
          product_name: prod.name,
          queue_status: "flagged",
          investigation_status: "open",
        },
      })
      .select("id")
      .maybeSingle()

    if (insErr || !alertRow?.id) continue

    const alertId = alertRow.id as string

    await admin.from("fraud_investigations").insert({
      alert_id: alertId,
      case_label: `Case ${alertId.slice(0, 8)}`,
      metadata: { origin: "passport_scan_sync" },
    })

    await admin.from("alert_evidence").insert({
      alert_id: alertId,
      evidence_type: "scan_snapshot",
      payload: evidenceSnapshot,
      source: "passport_scan",
    })

    await admin.from("alert_status_history").insert({
      alert_id: alertId,
      from_status: null,
      to_status: "new",
      actor_id: null,
      note: "Alert opened from scan telemetry",
      metadata: { passport_scan_id: s.id },
    })

    inserted += 1
  }

  return inserted
}

export async function listInvestigationAlerts(
  userId: string,
  limit = 60,
  options?: { skipSync?: boolean },
): Promise<InvestigationAlertRow[]> {
  if (!options?.skipSync) {
    await syncCounterfeitAlertsFromScans(userId)
  }
  const orgId = await getUserOrgId(userId)
  const orFilter = counterfeitAlertsOrFilter(userId, orgId)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("counterfeit_alerts")
    .select(
      `
      id,
      investigation_ref,
      product_id,
      passport_id,
      qr_identity_id,
      issue_type,
      severity,
      priority,
      status,
      confidence_score,
      risk_score_snapshot,
      trigger_source,
      region,
      scan_count,
      last_scan_at,
      assigned_to,
      sla_due_at,
      created_at,
      source_rule_id,
      products!inner(id, name, batch_id, risk_score, verification_status, qr_identity_id, base_data),
      passports(id, serial_number, status)
    `,
    )
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  const rows = data as unknown as DbAlert[]
  const assignees = await loadAssigneeLabels(rows.map((r) => r.assigned_to).filter(Boolean) as string[])
  const qrIds = rows
    .map((r) => {
      const p = first(r.products)
      return r.qr_identity_id ?? p?.qr_identity_id ?? null
    })
    .filter(Boolean) as string[]
  const qrCodes = await loadQrCodes(qrIds)
  return rows.map((r) => toRow(r, assignees, qrCodes))
}

/**
 * Queue metrics for investigation cards.
 * Filter: status = 'flagged' AND investigation_status = 'open'
 * (stored on event_metadata; falls back to open alert + open fraud_investigations row).
 */
export async function countFlaggedOpenInvestigationQueue(userId: string): Promise<{
  open_investigations: number
  sla_overdue: number
}> {
  const orgId = await getUserOrgId(userId)
  const orFilter = counterfeitAlertsOrFilter(userId, orgId)
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: flaggedRows, error: flaggedError } = await admin
    .from("counterfeit_alerts")
    .select("id, sla_due_at")
    .or(orFilter)
    .eq("event_metadata->>queue_status", "flagged")
    .eq("event_metadata->>investigation_status", "open")

  if (!flaggedError && flaggedRows?.length) {
    let overdue = 0
    for (const row of flaggedRows) {
      const sla = row.sla_due_at ? new Date(String(row.sla_due_at)).getTime() : null
      if (sla && sla < Date.now()) overdue += 1
    }
    return { open_investigations: flaggedRows.length, sla_overdue: overdue }
  }

  const { data: fallbackRows, error: fallbackError } = await admin
    .from("counterfeit_alerts")
    .select("id, sla_due_at, fraud_investigations!inner(closed_at)")
    .or(orFilter)
    .is("fraud_investigations.closed_at", null)
    .not("status", "in", '("resolved","archived","false_positive")')

  if (fallbackError || !fallbackRows?.length) {
    return { open_investigations: 0, sla_overdue: 0 }
  }

  let overdue = 0
  for (const row of fallbackRows) {
    const sla = row.sla_due_at ? new Date(String(row.sla_due_at)).getTime() : null
    if (sla && sla < Date.now()) overdue += 1
  }

  return { open_investigations: fallbackRows.length, sla_overdue: overdue }
}

export async function getInvestigationSummary(userId: string): Promise<InvestigationSummary> {
  const orgId = await getUserOrgId(userId)
  const orFilter = counterfeitAlertsOrFilter(userId, orgId)
  const { start } = boundsLastDays(30)
  const admin = createAdminClient()

  const [queueCounts, queryResult] = await Promise.all([
    countFlaggedOpenInvestigationQueue(userId),
    admin
      .from("counterfeit_alerts")
      .select(
        "issue_type, status, severity, region, created_at, resolved_at, confidence_score, sla_due_at",
      )
      .or(orFilter)
      .gte("created_at", start),
  ])

  const { data, error } = queryResult

  if (error || !data?.length) {
    return {
      total_open: queueCounts.open_investigations,
      critical_open: 0,
      overdue: queueCounts.sla_overdue,
      by_issue_type: [],
      by_status: [],
      alerts_per_day: [],
      avg_confidence: 0,
      false_positive_rate: null,
    }
  }

  const openStatuses = new Set([
    "new",
    "investigating",
    "pending_evidence",
    "escalated",
    "confirmed_fraud",
  ])
  let total_open = 0
  let critical_open = 0
  let overdue = 0
  const now = Date.now()

  const byIssue: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byDay: Record<string, number> = {}
  let confSum = 0
  let fp = 0
  let resolved = 0

  for (const raw of data as Record<string, unknown>[]) {
    const status = raw.status as string
    const issue = raw.issue_type as string
    const sev = raw.severity as string
    const conf = Number(raw.confidence_score ?? 0)
    confSum += conf
    byIssue[issue] = (byIssue[issue] ?? 0) + 1
    byStatus[status] = (byStatus[status] ?? 0) + 1
    const day = String(raw.created_at).slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + 1
    if (openStatuses.has(status)) {
      total_open += 1
      if (sev === "critical") critical_open += 1
      const sla = raw.sla_due_at ? new Date(String(raw.sla_due_at)).getTime() : null
      if (sla && sla < now) overdue += 1
    }
    if (status === "false_positive") fp += 1
    if (status === "resolved" || status === "archived") resolved += 1
  }

  const alerts_per_day = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }))

  const by_issue_type = Object.entries(byIssue).map(([type, count]) => ({
    type: type as CounterfeitIssueType,
    count,
  }))

  const by_status = Object.entries(byStatus).map(([status, count]) => ({
    status: status as CounterfeitAlertStatus,
    count,
  }))

  const denom = fp + resolved
  return {
    total_open: queueCounts.open_investigations,
    critical_open,
    overdue: queueCounts.sla_overdue,
    by_issue_type,
    by_status,
    alerts_per_day,
    avg_confidence: data.length ? Math.round(confSum / data.length) : 0,
    false_positive_rate: denom > 0 ? Math.round((fp / denom) * 1000) / 10 : null,
  }
}

export async function getInvestigationAlertDetail(
  userId: string,
  alertId: string,
): Promise<InvestigationAlertDetail | null> {
  const orgId = await getUserOrgId(userId)
  const orFilter = counterfeitAlertsOrFilter(userId, orgId)
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from("counterfeit_alerts")
    .select(
      `
      *,
      products!inner(id, name, batch_id, risk_score, verification_status, qr_identity_id, base_data),
      passports(id, serial_number, status)
    `,
    )
    .eq("id", alertId)
    .or(orFilter)
    .maybeSingle()

  if (error || !row) return null

  const base = row as unknown as DbAlert
  const assignees = await loadAssigneeLabels(
    base.assigned_to ? [base.assigned_to] : [],
  )
  const prod = first(base.products)
  const qid = base.qr_identity_id ?? prod?.qr_identity_id ?? null
  const qrCodes = await loadQrCodes(qid ? [qid] : [])
  const listRow = toRow(base, assignees, qrCodes)

  const [{ data: evidence }, { data: comments }, { data: history }, { data: scans }, { data: verifs }] =
    await Promise.all([
      admin
        .from("alert_evidence")
        .select("id, evidence_type, payload, source, created_at")
        .eq("alert_id", alertId)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("alert_comments")
        .select("id, body, author_id, created_at, is_internal")
        .eq("alert_id", alertId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("alert_status_history")
        .select("id, from_status, to_status, created_at, note")
        .eq("alert_id", alertId)
        .order("created_at", { ascending: true })
        .limit(80),
      base.passport_id
        ? admin
            .from("passport_scans")
            .select(
              "id, scan_timestamp, scan_result, location_city, location_country, risk_score, device_type, ip_address",
            )
            .eq("passport_id", base.passport_id)
            .order("scan_timestamp", { ascending: false })
            .limit(25)
        : Promise.resolve({ data: null }),
      admin
        .from("verification_events")
        .select("event_type, event_message, triggered_at, score_change, risk_after")
        .eq("product_id", base.product_id)
        .order("triggered_at", { ascending: false })
        .limit(15),
    ])

  const evidenceItems: InvestigationEvidenceItem[] = (evidence ?? []).map((e) => {
    const x = e as Record<string, unknown>
    return {
      id: String(x.id),
      evidence_type: String(x.evidence_type),
      payload: (x.payload as Record<string, unknown>) ?? {},
      source: x.source ? String(x.source) : null,
      created_at: String(x.created_at),
    }
  })

  const commentItems: InvestigationComment[] = (comments ?? []).map((c) => {
    const x = c as Record<string, unknown>
    return {
      id: String(x.id),
      body: String(x.body),
      author_id: x.author_id ? String(x.author_id) : null,
      created_at: String(x.created_at),
      is_internal: Boolean(x.is_internal),
    }
  })

  const status_history: StatusHistoryEntry[] = (history ?? []).map((h) => {
    const x = h as Record<string, unknown>
    return {
      id: String(x.id),
      from_status: (x.from_status as CounterfeitAlertStatus) ?? null,
      to_status: x.to_status as CounterfeitAlertStatus,
      at: String(x.created_at),
      note: x.note ? String(x.note) : null,
    }
  })

  const timeline: InvestigationTimelineEntry[] = []

  for (const h of status_history) {
    timeline.push({
      at: h.at,
      kind: "status",
      label: `Status → ${h.to_status}`,
      detail: h.note ?? undefined,
    })
  }

  for (const c of commentItems) {
    timeline.push({
      at: c.created_at,
      kind: "comment",
      label: "Analyst note",
      detail: c.body.slice(0, 140),
    })
  }

  for (const sc of scans ?? []) {
    const x = sc as Record<string, unknown>
    const ts = String(x.scan_timestamp)
    timeline.push({
      at: ts,
      kind: "scan",
      label: `Scan (${x.scan_result})`,
      detail: [x.location_city, x.location_country].filter(Boolean).join(", ") || undefined,
    })
  }

  for (const v of verifs ?? []) {
    const x = v as Record<string, unknown>
    timeline.push({
      at: String(x.triggered_at),
      kind: "verification",
      label: String(x.event_type),
      detail: String(x.event_message),
    })
  }

  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const map_points: InvestigationMapPoint[] = []
  for (const sc of scans ?? []) {
    const x = sc as Record<string, unknown>
    const country = x.location_country ? String(x.location_country) : null
    const city = x.location_city ? String(x.location_city) : null
    const { lat, long } = approxCoordsFromLocation(country, city)
    map_points.push({
      id: String(x.id),
      lat,
      long,
      label: [city, country].filter(Boolean).join(", ") || "Scan",
      at: String(x.scan_timestamp),
      kind: "scan",
    })
  }
  if (listRow.region) {
    const parts = listRow.region.split(",").map((p) => p.trim())
    const { lat, long } = approxCoordsFromLocation(parts[1] ?? parts[0] ?? null, parts[0] ?? null)
    map_points.push({
      id: "alert-region",
      lat,
      long,
      label: `Alert region: ${listRow.region}`,
      at: listRow.created_at,
      kind: "alert",
    })
  }

  const snap = (base.evidence_snapshot ?? {}) as Record<string, unknown>
  const bd = (snap.confidence_breakdown ?? null) as ConfidenceBreakdown["factors"] | null
  const analytics_hint: ConfidenceBreakdown = {
    total: listRow.confidence_score,
    factors: Array.isArray(bd)
      ? bd.map((f) => ({
          label: String((f as { label?: string }).label ?? "Factor"),
          weight: Number((f as { weight?: number }).weight ?? 0),
        }))
      : [{ label: "Model confidence", weight: listRow.confidence_score }],
  }

  return {
    ...listRow,
    evidence_snapshot: (base.evidence_snapshot ?? {}) as Record<string, unknown>,
    event_metadata: (base.event_metadata ?? {}) as Record<string, unknown>,
    investigation_notes: base.investigation_notes ?? null,
    resolution_type: (base.resolution_type as InvestigationAlertDetail["resolution_type"]) ?? null,
    resolution_notes: base.resolution_notes ?? null,
    resolved_at: base.resolved_at ?? null,
    resolved_by: base.resolved_by ?? null,
    timeline,
    evidence: evidenceItems,
    comments: commentItems,
    map_points,
    status_history,
    analytics_hint,
  }
}

export async function assertAlertScoped(
  userId: string,
  alertId: string,
): Promise<{ id: string; product_id: string; passport_id: string | null; qr_identity_id: string | null; status: CounterfeitAlertStatus; issue_type: CounterfeitIssueType } | null> {
  const orgId = await getUserOrgId(userId)
  const orFilter = counterfeitAlertsOrFilter(userId, orgId)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("counterfeit_alerts")
    .select("id, product_id, passport_id, qr_identity_id, status, issue_type")
    .eq("id", alertId)
    .or(orFilter)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    passport_id: row.passport_id ? String(row.passport_id) : null,
    qr_identity_id: row.qr_identity_id ? String(row.qr_identity_id) : null,
    status: row.status as CounterfeitAlertStatus,
    issue_type: row.issue_type as CounterfeitIssueType,
  }
}

export async function appendStatusHistory(
  alertId: string,
  from: CounterfeitAlertStatus | null,
  to: CounterfeitAlertStatus,
  actorId: string | null,
  note: string | null,
  metadata: Record<string, unknown>,
) {
  const admin = createAdminClient()
  await admin.from("alert_status_history").insert({
    alert_id: alertId,
    from_status: from,
    to_status: to,
    actor_id: actorId,
    note,
    metadata,
  })
}

export async function writeAudit(
  userId: string | null,
  action: string,
  resourceId: string,
  metadata: Record<string, unknown>,
) {
  const admin = createAdminClient()
  await admin.from("audit_logs").insert({
    user_id: userId,
    action,
    resource: resourceId,
    metadata,
  })
}

export { deltaForIssue, RISK_DELTA, clampRisk }
