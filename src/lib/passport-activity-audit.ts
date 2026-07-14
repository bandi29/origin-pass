import type { PassportActivityLogEntry } from "@/lib/passport-activity-types"
import {
  PASSPORT_ACTIVITY_UPDATE_AUDIT_ACTIONS,
  passportActivityUpdateDescription,
  passportActivityUpdateEventTitle,
} from "@/lib/passport-activity-types"

export type PassportActivityUpdateAuditAction =
  (typeof PASSPORT_ACTIVITY_UPDATE_AUDIT_ACTIONS)[number]

export function isPassportActivityUpdateAuditAction(action: string): boolean {
  return (PASSPORT_ACTIVITY_UPDATE_AUDIT_ACTIONS as readonly string[]).includes(action)
}

type AuditLogRow = {
  id: string
  user_id: string | null
  action: string
  resource: string
  metadata: Record<string, unknown> | null
  created_at: string
}

function resolveUpdateTarget(
  metadata: Record<string, unknown>,
  resource: string,
): Pick<PassportActivityLogEntry, "targetLabel" | "targetHref"> {
  const serial =
    typeof metadata.serial_number === "string" ? metadata.serial_number.trim() : ""
  if (serial) {
    return {
      targetLabel: serial,
      targetHref: `/verify/${encodeURIComponent(serial)}`,
    }
  }

  const productName =
    typeof metadata.product_name === "string" ? metadata.product_name.trim() : ""
  if (productName) {
    return {
      targetLabel: productName,
      targetHref: "/dashboard/products",
    }
  }

  const templateKey =
    typeof metadata.template_key === "string" ? metadata.template_key.trim() : ""
  if (templateKey) {
    return {
      targetLabel: templateKey,
      targetHref: "/dashboard/product-passports/passport-templates",
    }
  }

  const resourceLabel = resource.replace(/-/g, "").slice(0, 12) || "Asset"
  return {
    targetLabel: resourceLabel,
    targetHref: "/dashboard/product-passports",
  }
}

/** Maps an org-scoped audit_logs row into a passport activity grid row. */
export function mapPassportActivityUpdateAuditRow(
  row: AuditLogRow,
  scopedProductIds: Set<string>,
): PassportActivityLogEntry | null {
  if (!isPassportActivityUpdateAuditAction(row.action)) return null

  const metadata = row.metadata ?? {}
  const productId = typeof metadata.product_id === "string" ? metadata.product_id : null
  if (productId && scopedProductIds.size > 0 && !scopedProductIds.has(productId)) {
    return null
  }

  const { targetLabel, targetHref } = resolveUpdateTarget(metadata, row.resource)

  return {
    id: `audit-${row.id}`,
    eventType: "METADATA_UPDATED",
    eventTitle: passportActivityUpdateEventTitle(row.action),
    description: passportActivityUpdateDescription(row.action, metadata),
    targetLabel,
    targetHref,
    occurredAt: row.created_at,
    isDemo: false,
  }
}
