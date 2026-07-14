/** Operations module hub (sidebar + top nav landing). */
export const OPERATIONS_MODULE_HUB_PATH = "/dashboard/operations" as const

export const OWNERSHIP_HUB_PATH = "/dashboard/ownership" as const

export function isOperationsModuleHubPath(path: string): boolean {
  return path === OPERATIONS_MODULE_HUB_PATH
}

export function isOperationsModulePath(path: string): boolean {
  return (
    path === OPERATIONS_MODULE_HUB_PATH ||
    path.startsWith(`${OPERATIONS_MODULE_HUB_PATH}/`) ||
    path === OWNERSHIP_HUB_PATH ||
    path.startsWith(`${OWNERSHIP_HUB_PATH}/`)
  )
}
