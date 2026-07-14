import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function DashboardAuthenticityOverviewRedirect() {
  redirect(VERIFICATION_ROUTES.overview)
}
