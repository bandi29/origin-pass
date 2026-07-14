import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function DashboardAuthenticityAuditRedirect() {
  redirect(VERIFICATION_ROUTES.audit)
}
