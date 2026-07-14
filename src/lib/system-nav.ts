/** System module hub (sidebar + top nav landing). */
export const SYSTEM_MODULE_HUB_PATH = "/dashboard/system" as const

export const TEAM_PATH = "/dashboard/team" as const

export const API_KEYS_PATH = "/dashboard/integrations/api-keys" as const

export const SETTINGS_PATH = "/dashboard/settings" as const

export function isSystemModuleHubPath(path: string): boolean {
  return path === SYSTEM_MODULE_HUB_PATH
}

export function isSystemModulePath(path: string): boolean {
  return (
    path === SYSTEM_MODULE_HUB_PATH ||
    path.startsWith(`${SYSTEM_MODULE_HUB_PATH}/`) ||
    path === TEAM_PATH ||
    path.startsWith(`${TEAM_PATH}/`) ||
    path === API_KEYS_PATH ||
    path.startsWith(`${API_KEYS_PATH}/`) ||
    path === SETTINGS_PATH ||
    path.startsWith(`${SETTINGS_PATH}/`) ||
    path.startsWith("/dashboard/integrations/")
  )
}
