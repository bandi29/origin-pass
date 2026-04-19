import { redirect } from "next/navigation"

export default function AuthenticityRulesPage() {
  redirect("/dashboard/authenticity/rules")
}
