import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function VerificationSectionPage() {
  redirect(VERIFICATION_ROUTES.alerts)
}
