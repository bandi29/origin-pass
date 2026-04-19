import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { userHasOrganization } from "@/lib/auth-org"
import { AuthPageShell } from "@/components/auth/AuthPageShell"
import { LoginForm } from "@/components/auth/LoginForm"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    if (!(await userHasOrganization(user.id))) {
      redirect("/signup/complete")
    }
    redirect("/dashboard")
  }

  return (
    <AuthPageShell
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Sign in" },
      ]}
      marketing={{
        title: "Digital Product Passports for authentic brands.",
        body:
          "Verify scans, protect your craft, and give customers confidence — passports, ownership, and analytics in one calm workspace.",
        footer: "Trusted by artisans and growing brands.",
      }}
    >
      <Suspense fallback={<div className="text-[15px] text-zinc-400">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  )
}
