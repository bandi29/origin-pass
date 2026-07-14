import { redirect } from "next/navigation"
import { SCAN_ANALYTICS_PATH } from "@/lib/analytics-nav"

export default function DashboardScansRedirect() {
  redirect(SCAN_ANALYTICS_PATH)
}
