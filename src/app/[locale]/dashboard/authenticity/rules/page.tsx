import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function DashboardAuthenticityRulesRedirect() {
  redirect(VERIFICATION_ROUTES.rules)
}
