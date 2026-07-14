/**
 * Extensible verification field keys for supplier certificate evidence.
 * Add new keys here as passport claims expand — no schema migration required.
 */
export const VERIFICATION_FIELD_KEYS = {
  PRODUCTION_LOCATION: "production_location",
  CARE_INSTRUCTIONS: "care_instructions",
  MATERIALS: "materials",
  CARBON_FOOTPRINT: "carbon_footprint",
  SUBSTANCES: "substances",
  RECYCLING: "recycling",
} as const

export type VerificationFieldKey = (typeof VERIFICATION_FIELD_KEYS)[keyof typeof VERIFICATION_FIELD_KEYS]

/** Shopify app-home UI fields mapped to stored field_key values. */
export const SHOPIFY_CERTIFICATE_UI_FIELDS = {
  location: VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION,
  care: VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
} as const

export type ShopifyCertificateUiField = keyof typeof SHOPIFY_CERTIFICATE_UI_FIELDS

export function isShopifyCertificateUiField(value: unknown): value is ShopifyCertificateUiField {
  return value === "location" || value === "care"
}

export function verificationFieldKeyForUi(field: ShopifyCertificateUiField): VerificationFieldKey {
  return SHOPIFY_CERTIFICATE_UI_FIELDS[field]
}
