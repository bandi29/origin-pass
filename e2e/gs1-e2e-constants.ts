/**
 * Shared GS1-01 fixture constants (must match scripts/seed-dev.mjs).
 *
 * Note: Requested GTIN 00810012345678 fails Mod-10 (check digit should be 5).
 * Public redirect shape is `/sp/{shopSlug}/{external_product_id}` (not a single-segment /sp id).
 */
export const GS1_E2E_GTIN = "00810012345675"
export const GS1_E2E_PASSPORT_ID = "passport-e2e-gs1-01"
export const GS1_E2E_SHOP_SLUG = "originpass-sandbox"
export const GS1_E2E_LOCATION_PATH = `/sp/${GS1_E2E_SHOP_SLUG}/${GS1_E2E_PASSPORT_ID}`
