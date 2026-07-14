import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function DashboardAuthenticityAlertsRedirect() {
  redirect(VERIFICATION_ROUTES.alerts)
}
