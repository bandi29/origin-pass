import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { userHasOrganization } from "@/lib/auth-org"
import { AuthPageShell } from "@/components/auth/AuthPageShell"
import { SignupForm } from "@/components/auth/SignupForm"

export default async function SignupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    if (await userHasOrganization(user.id)) {
      redirect("/dashboard")
    }
    redirect("/signup/complete")
  }

  return (
    <AuthPageShell
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Create account" },
      ]}
      marketing={{
        title: "One workspace for passports, scans, and trust.",
        body:
          "Create your organization in minutes. Data stays isolated per tenant — built for teams that care about authenticity and scale.",
        footer: "No credit card required to explore.",
      }}
    >
      <SignupForm />
    </AuthPageShell>
  )
}
