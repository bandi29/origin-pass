import { redirect } from "next/navigation"

export default function AuthenticityAlertsPage() {
  redirect("/dashboard/authenticity/alerts")
}
