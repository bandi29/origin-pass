import { FileSearch, ShieldAlert, ShieldCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  OPERATIONS_COMPLIANCE_HUB_PATH,
  OPERATIONS_SECURITY_LOGS_PATH,
} from "@/lib/verification-nav"
import { OWNERSHIP_HUB_PATH } from "@/lib/operations-nav"

export type OperationsModule = {
  id: string
  href: string
  title: string
  description: string
  icon: LucideIcon
}

export const operationsModules: OperationsModule[] = [
  {
    id: "ownership",
    href: OWNERSHIP_HUB_PATH,
    title: "Ownership Hub",
    description: "Track ownership records, transfers, and warranty lifecycle events.",
    icon: FileSearch,
  },
  {
    id: "compliance",
    href: OPERATIONS_COMPLIANCE_HUB_PATH,
    title: "Supplier Intelligence",
    description: "Monitor supplier compliance signals and EU DPP readiness.",
    icon: ShieldCheck,
  },
  {
    id: "security-logs",
    href: OPERATIONS_SECURITY_LOGS_PATH,
    title: "Security Logs",
    description: "Review platform security events and administrative audit trails.",
    icon: ShieldAlert,
  },
]
