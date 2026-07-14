/** Product Identity module hub (relocated from legacy `/product/*`). */
export const PRODUCT_IDENTITY_MODULE_HUB_PATH = "/dashboard/product-identity" as const

export const PRODUCT_IDENTITY_PASSPORTS_PATH = `${PRODUCT_IDENTITY_MODULE_HUB_PATH}/passports` as const

export function isProductIdentityModuleHubPath(path: string): boolean {
  return path === PRODUCT_IDENTITY_MODULE_HUB_PATH
}

export function isProductIdentityModulePath(path: string): boolean {
  return (
    path === PRODUCT_IDENTITY_MODULE_HUB_PATH ||
    path.startsWith(`${PRODUCT_IDENTITY_MODULE_HUB_PATH}/`)
  )
}

export function productIdentityModulePath(module: string, ...rest: string[]): string {
  const segments = [PRODUCT_IDENTITY_MODULE_HUB_PATH, module, ...rest].filter(Boolean)
  return segments.join("/")
}
