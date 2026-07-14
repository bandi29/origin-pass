import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedOrgId, getScopedProductIds, NIL_UUID } from "@/backend/modules/organizations/scope"
import type { PreparedPassportImportRecord } from "@/lib/passport-batch-import-types"
import type {
  ComplianceValidationPayload,
  ComplianceValidationRow,
  ComplianceValidationTier,
} from "@/lib/compliance-validation-types"

const ROW_LIMIT = 200

const INVALID_ORIGIN_TOKENS = new Set(["", "—", "-", "n/a", "na", "unknown", "tbd"])

const ACTION_REQUIRED_COMPLIANCE = {
  tier: "action_required" as const,
  label: "Missing Material Certs" as const,
}

/** Coerce sheet/parser values (null, numbers, booleans) into a trimmed string. */
export function coerceSpreadsheetText(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

export function isValidOriginGeo(value: unknown): boolean {
  const normalized = coerceSpreadsheetText(value).toLowerCase()
  if (INVALID_ORIGIN_TOKENS.has(normalized)) return false
  return normalized.length >= 2
}

export function resolveComplianceTier(input?: {
  originGeo?: unknown
  description?: unknown
} | null): { tier: ComplianceValidationTier; label: ComplianceValidationRow["complianceLabel"] } {
  const originGeo = coerceSpreadsheetText(input?.originGeo)
  const description = coerceSpreadsheetText(input?.description)
  const originGeoValid = isValidOriginGeo(originGeo)
  const hasDescription = description.length > 0

  if (originGeoValid && hasDescription) {
    return { tier: "fully_compliant", label: "EU Validated" }
  }

  return ACTION_REQUIRED_COMPLIANCE
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(record: Record<string, unknown>, key: string): string {
  return coerceSpreadsheetText(record[key])
}

function mapManifestRecord(
  record: PreparedPassportImportRecord | Record<string, unknown>,
  jobUpdatedAt: string,
  index: number,
): ComplianceValidationRow {
  const raw = record as Record<string, unknown>
  const originGeo = coerceSpreadsheetText(raw.origin_geo)
  const description = coerceSpreadsheetText(raw.description)
  const resolved = resolveComplianceTier({ originGeo, description })

  return {
    id: `manifest-${coerceSpreadsheetText(raw.id) || index}-${index}`,
    productSku: coerceSpreadsheetText(raw.sku) || "—",
    productName: coerceSpreadsheetText(raw.product_name) || "Unknown product",
    batchId: coerceSpreadsheetText(raw.batch_id) || "—",
    originGeo: originGeo || "—",
    description,
    originGeoValid: isValidOriginGeo(originGeo),
    complianceTier: resolved.tier,
    complianceLabel: resolved.label,
    source: "manifest_queue",
    updatedAt: jobUpdatedAt,
  }
}

function mapPassportRow(
  row: {
    id: string
    created_at: string
    metadata: unknown
    products:
      | {
          id: string
          name: string | null
          sku: string | null
          origin: string | null
          description: string | null
        }
      | {
          id: string
          name: string | null
          sku: string | null
          origin: string | null
          description: string | null
        }[]
      | null
  },
): ComplianceValidationRow | null {
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  if (!product?.id) return null

  const metadata = asRecord(row.metadata)
  const originGeo =
    stringField(metadata, "origin_geo") ||
    coerceSpreadsheetText(product.origin) ||
    ""
  const description =
    stringField(metadata, "description") ||
    coerceSpreadsheetText(product.description) ||
    ""
  const resolved = resolveComplianceTier({ originGeo, description })

  return {
    id: row.id,
    productSku: stringField(metadata, "sku") || coerceSpreadsheetText(product.sku) || "—",
    productName:
      stringField(metadata, "product_name") ||
      coerceSpreadsheetText(product.name) ||
      "Unknown product",
    batchId: stringField(metadata, "batch_id") || "—",
    originGeo: originGeo || "—",
    description,
    originGeoValid: isValidOriginGeo(originGeo),
    complianceTier: resolved.tier,
    complianceLabel: resolved.label,
    source: "passport",
    updatedAt: row.created_at,
  }
}

function dedupeRows(rows: ComplianceValidationRow[]): ComplianceValidationRow[] {
  const seen = new Set<string>()
  const out: ComplianceValidationRow[] = []

  for (const row of rows) {
    const key = `${row.productSku.toLowerCase()}::${row.batchId.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }

  return out
}

function summarizeRows(rows: ComplianceValidationRow[]): ComplianceValidationPayload {
  const compliantCount = rows.filter((row) => row.complianceTier === "fully_compliant").length
  const actionRequiredCount = rows.filter((row) => row.complianceTier === "action_required").length
  return {
    rows,
    totalCount: rows.length,
    compliantCount,
    actionRequiredCount,
  }
}

/** Live EU DPP validation matrix sourced from passports and queued manifest imports. */
export async function getComplianceValidationForUser(
  userId: string,
): Promise<ComplianceValidationPayload> {
  const admin = createAdminClient()
  const orgId = await getScopedOrgId(userId)
  const productIds = await getScopedProductIds(userId)
  const scopedProductIds = productIds.length ? productIds : [NIL_UUID]

  const passportQuery = admin
    .from("passports")
    .select(
      "id, created_at, metadata, products!inner(id, name, sku, origin, description)",
    )
    .in("product_id", scopedProductIds)
    .order("created_at", { ascending: false })
    .limit(ROW_LIMIT)

  let batchQuery = admin
    .from("qr_batch_jobs")
    .select("id, created_at, metadata, job_name, status")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(30)

  if (orgId) {
    batchQuery = batchQuery.eq("organization_id", orgId)
  }

  const [{ data: passportRows, error: passportError }, { data: batchRows, error: batchError }] =
    await Promise.all([passportQuery, batchQuery])

  if (passportError) {
    console.warn("getComplianceValidationForUser passports:", passportError.message)
  }
  if (batchError) {
    console.warn("getComplianceValidationForUser batch jobs:", batchError.message)
  }

  const passportMapped = (passportRows ?? [])
    .map((row) => mapPassportRow(row as Parameters<typeof mapPassportRow>[0]))
    .filter((row): row is ComplianceValidationRow => row !== null)

  const manifestMapped: ComplianceValidationRow[] = []
  for (const job of batchRows ?? []) {
    const metadata = asRecord(job.metadata)
    if (metadata.source !== "passport_manifest_import") continue

    const payload = asRecord(metadata.import_payload)
    const records = payload.records
    if (!Array.isArray(records)) continue

    const updatedAt =
      (typeof job.created_at === "string" && job.created_at) || new Date().toISOString()

    records.forEach((record, index) => {
      if (!record || typeof record !== "object") return
      manifestMapped.push(
        mapManifestRecord(record as PreparedPassportImportRecord, updatedAt, index),
      )
    })
  }

  const merged = dedupeRows([...passportMapped, ...manifestMapped])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, ROW_LIMIT)

  return summarizeRows(merged)
}
