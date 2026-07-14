import { redirect } from "next/navigation"
import { SCAN_ANALYTICS_PATH } from "@/lib/analytics-nav"

/** Legacy /dashboard/scans/* paths fall back to the canonical Scan Analytics route. */
export default function DashboardScansSectionRedirect() {
  redirect(SCAN_ANALYTICS_PATH)
}
