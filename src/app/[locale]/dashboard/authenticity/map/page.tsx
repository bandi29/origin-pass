import { redirect } from "next/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default function DashboardAuthenticityMapRedirect() {
  redirect(VERIFICATION_ROUTES.map)
}
