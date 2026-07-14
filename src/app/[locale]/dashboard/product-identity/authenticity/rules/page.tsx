import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function ProductAuthenticityRulesRedirect() {
  redirect(VERIFICATION_ROUTES.rules)
}
