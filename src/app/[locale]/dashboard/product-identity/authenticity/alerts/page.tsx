import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function ProductAuthenticityAlertsRedirect() {
  redirect(VERIFICATION_ROUTES.alerts)
}
