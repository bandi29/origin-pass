import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function DashboardVerificationAnalyticsRedirect() {
  redirect(VERIFICATION_ROUTES.analytics)
}
