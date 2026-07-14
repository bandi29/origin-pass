import { BarChart3, LineChart } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { FRAUD_ANALYTICS_PATH } from "@/lib/verification-nav"
import { SCAN_ANALYTICS_PATH } from "@/lib/analytics-nav"

export type AnalyticsModule = {
  id: string
  href: string
  title: string
  description: string
  icon: LucideIcon
}

export const analyticsModules: AnalyticsModule[] = [
  {
    id: "scan-analytics",
    href: SCAN_ANALYTICS_PATH,
    title: "Scan Analytics",
    description: "Monitor scan volume, activity trends, and engagement over time.",
    icon: LineChart,
  },
  {
    id: "fraud-analytics",
    href: FRAUD_ANALYTICS_PATH,
    title: "Fraud Analytics",
    description: "Investigate verification risk signals and suspicious scan patterns.",
    icon: BarChart3,
  },
]
