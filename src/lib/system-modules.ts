import { KeyRound, Settings, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { API_KEYS_PATH, SETTINGS_PATH, TEAM_PATH } from "@/lib/system-nav"

export type SystemModule = {
  id: string
  href: string
  title: string
  description: string
  icon: LucideIcon
}

export const systemModules: SystemModule[] = [
  {
    id: "team",
    href: TEAM_PATH,
    title: "Team",
    description: "Invite collaborators, assign roles, and manage organization access.",
    icon: Users,
  },
  {
    id: "api-keys",
    href: API_KEYS_PATH,
    title: "API Keys",
    description: "Create and rotate credentials for integrations and automation.",
    icon: KeyRound,
  },
  {
    id: "settings",
    href: SETTINGS_PATH,
    title: "Settings",
    description: "Configure account preferences, billing, and workspace defaults.",
    icon: Settings,
  },
]
