export type ComplianceValidationTier = "fully_compliant" | "action_required"

export type ComplianceFilterTier = "all" | "fully_compliant" | "action_required"

export type ComplianceValidationRow = {
  id: string
  productSku: string
  productName: string
  batchId: string
  originGeo: string
  description: string
  originGeoValid: boolean
  complianceTier: ComplianceValidationTier
  complianceLabel: "EU Validated" | "Missing Material Certs"
  source: "passport" | "manifest_queue"
  updatedAt: string
}

export type ComplianceValidationPayload = {
  rows: ComplianceValidationRow[]
  totalCount: number
  compliantCount: number
  actionRequiredCount: number
}
