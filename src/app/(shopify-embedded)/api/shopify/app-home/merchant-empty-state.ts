export type MerchantEmptyStateConfig = {
  connected: boolean
  productionLocation: string
  careInstructions: string
}

/** Persisted brand defaults count as configured only when the store is linked. */
export function hasMerchantConfigurationSetup(config: MerchantEmptyStateConfig): boolean {
  if (!config.connected) return false
  return config.productionLocation.trim() !== "" || config.careInstructions.trim() !== ""
}

/**
 * First-time merchant empty state: no synced products and no brand configuration
 * (or store not yet connected).
 */
export function shouldShowMerchantEmptyState(
  productCount: number,
  config: MerchantEmptyStateConfig,
): boolean {
  if (productCount > 0) return false
  return !hasMerchantConfigurationSetup(config)
}
