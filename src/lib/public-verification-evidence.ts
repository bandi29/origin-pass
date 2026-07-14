import { createServerSupabaseClient } from "@/lib/supabase"
import { supplierCertificatePublicUrl } from "@/lib/supplier-certificates"
import type { DataProvenance, EvidenceScope } from "@/lib/evidence-scope"
import { fieldDataProvenance } from "@/lib/evidence-scope"
import { resolveFieldLineageState, type FieldLineageState } from "@/lib/field-lineage"
import { readProductComplianceField } from "@/lib/product-compliance-fields"
import {
  VERIFICATION_FIELD_KEYS,
  type VerificationFieldKey,
} from "@/lib/verification-field-keys"
import type { CertificateVerificationStatus } from "@/lib/verification-status"

export type PublicFieldEvidence = {
  fieldKey: VerificationFieldKey
  label: string
  verificationStatus: CertificateVerificationStatus
  hasDocument: boolean
  documentName: string | null
  /** Public asset URL in supplier-certificates bucket. */
  viewUrl: string | null
  /** Whether the displayed claim uses record-level values or brand defaults. */
  dataProvenance: DataProvenance
  /** Whether evidence is product-specific, brand-level, or absent. */
  evidenceScope: EvidenceScope
  /** Brand evidence shown against record-level data — must not imply product proof. */
  scopeMismatch: boolean
  /** Canonical lineage state — shared with merchant UI. */
  lineageState: FieldLineageState
}

const PUBLIC_FIELD_LABELS: Record<VerificationFieldKey, string> = {
  [VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION]: "Production location",
  [VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS]: "Care instructions",
  [VERIFICATION_FIELD_KEYS.MATERIALS]: "Materials",
  [VERIFICATION_FIELD_KEYS.CARBON_FOOTPRINT]: "Carbon footprint",
  [VERIFICATION_FIELD_KEYS.SUBSTANCES]: "Substances of concern",
  [VERIFICATION_FIELD_KEYS.RECYCLING]: "Recycling",
}

/** Fields surfaced on the consumer passport today (extend as claims ship). */
export const PUBLIC_PASSPORT_EVIDENCE_FIELDS: VerificationFieldKey[] = [
  VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION,
  VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
]

type CertRow = {
  field_key: string
  file_path: string
  original_filename: string
  verification_status: CertificateVerificationStatus
  product_id: string | null
}

async function findProductCertificate(
  storeId: string,
  productId: string,
  fieldKey: VerificationFieldKey,
): Promise<CertRow | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("certificates")
    .select("field_key, file_path, original_filename, verification_status, product_id")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .eq("field_key", fieldKey)
    .maybeSingle()
  return (data as CertRow | null) ?? null
}

async function findBrandCertificate(
  storeId: string,
  fieldKey: VerificationFieldKey,
): Promise<CertRow | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("certificates")
    .select("field_key, file_path, original_filename, verification_status, product_id")
    .eq("store_id", storeId)
    .is("product_id", null)
    .eq("field_key", fieldKey)
    .maybeSingle()
  return (data as CertRow | null) ?? null
}

function resolveFieldEvidence(input: {
  fieldKey: VerificationFieldKey
  label: string
  productCert: CertRow | null
  brandCert: CertRow | null
  dataProvenance: DataProvenance
  productValue: string | null
  brandDefault: string | null
  viewUrl: string | null
}): PublicFieldEvidence {
  const { fieldKey, label, productCert, brandCert, dataProvenance, productValue, brandDefault, viewUrl } = input
  const lineageState = resolveFieldLineageState({
    productValue,
    brandDefault,
    productCertPresent: Boolean(productCert),
    brandCertPresent: Boolean(brandCert),
  })

  if (lineageState === "overridden" && productCert) {
    return {
      fieldKey,
      label,
      verificationStatus: productCert.verification_status,
      hasDocument: true,
      documentName: productCert.original_filename,
      viewUrl,
      dataProvenance,
      evidenceScope: "product",
      scopeMismatch: false,
      lineageState,
    }
  }

  if (lineageState === "inherited" && brandCert) {
    return {
      fieldKey,
      label,
      verificationStatus: brandCert.verification_status,
      hasDocument: true,
      documentName: brandCert.original_filename,
      viewUrl,
      dataProvenance,
      evidenceScope: "brand",
      scopeMismatch: false,
      lineageState,
    }
  }

  if (lineageState === "conflict") {
    return {
      fieldKey,
      label,
      verificationStatus: "unverified",
      hasDocument: false,
      documentName: null,
      viewUrl: null,
      dataProvenance,
      evidenceScope: "none",
      scopeMismatch: true,
      lineageState,
    }
  }

  return {
    fieldKey,
    label,
    verificationStatus: "unverified",
    hasDocument: false,
    documentName: null,
    viewUrl: null,
    dataProvenance,
    evidenceScope: "none",
    scopeMismatch: false,
    lineageState,
  }
}

/**
 * Load verification evidence for the public passport (QR / customs-facing).
 * Product-scoped certificates win over brand-global rows per field_key.
 * Brand-level evidence is labeled explicitly and never presented as product proof
 * when the displayed claim uses record-level data.
 */
export async function fetchPublicVerificationEvidence(input: {
  storeId: string
  productId?: string | null
  fieldKeys?: VerificationFieldKey[]
  /** Whether this passport has any record-level compliance beyond brand defaults. */
  passportUsesRecordFields?: boolean
  /** Per-field claim provenance for production/care (from product compliance_data). */
  fieldClaimProvenance?: Partial<
    Record<typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS, DataProvenance>
  >
  productComplianceData?: unknown
  brandDefaults?: {
    productionLocation?: string | null
    careInstructions?: string | null
  }
}): Promise<PublicFieldEvidence[]> {
  const supabase = createServerSupabaseClient()
  const keys = input.fieldKeys ?? PUBLIC_PASSPORT_EVIDENCE_FIELDS
  const passportUsesRecordFields = input.passportUsesRecordFields ?? false
  const productId = input.productId ?? null

  const rows: PublicFieldEvidence[] = []
  for (const fieldKey of keys) {
    const label = PUBLIC_FIELD_LABELS[fieldKey] ?? fieldKey
    const brandDefault =
      fieldKey === VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION
        ? (input.brandDefaults?.productionLocation ?? null)
        : fieldKey === VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS
          ? (input.brandDefaults?.careInstructions ?? null)
          : null
    const productValue =
      fieldKey === VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION ||
      fieldKey === VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS
        ? readProductComplianceField(input.productComplianceData, fieldKey)
        : null
    const dataProvenance = fieldDataProvenance(fieldKey, {
      passportUsesRecordFields,
      fieldClaimProvenance:
        input.fieldClaimProvenance?.[
          fieldKey as typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS
        ],
    })

    const [productCert, brandCert] = await Promise.all([
      productId ? findProductCertificate(input.storeId, productId, fieldKey) : Promise.resolve(null),
      findBrandCertificate(input.storeId, fieldKey),
    ])

    const lineageState = resolveFieldLineageState({
      productValue,
      brandDefault,
      productCertPresent: Boolean(productCert),
      brandCertPresent: Boolean(brandCert),
    })
    const activeCert =
      lineageState === "overridden" && productCert
        ? productCert
        : lineageState === "inherited" && brandCert
          ? brandCert
          : null
    const viewUrl = activeCert ? supplierCertificatePublicUrl(supabase, activeCert.file_path) : null

    rows.push(
      resolveFieldEvidence({
        fieldKey,
        label,
        productCert,
        brandCert,
        dataProvenance,
        productValue,
        brandDefault,
        viewUrl,
      }),
    )
  }

  return rows
}

export function evidenceByFieldKey(
  rows: PublicFieldEvidence[],
): Partial<Record<VerificationFieldKey, PublicFieldEvidence>> {
  return Object.fromEntries(rows.map((row) => [row.fieldKey, row])) as Partial<
    Record<VerificationFieldKey, PublicFieldEvidence>
  >
}
