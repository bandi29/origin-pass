import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function VerificationsPage() {
  redirect(VERIFICATION_ROUTES.overview)
}
