export type OwnershipWarrantyStatus = "active" | "expired" | "pending"

export type OwnershipRecordRow = {
  id: string
  registrationId: string
  productSku: string
  productName: string
  ownerLabel: string
  warrantyStatus: OwnershipWarrantyStatus
  warrantyExpiresAt: string | null
  registeredAt: string
}
