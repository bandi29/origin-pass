import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { userHasOrganization } from "@/lib/auth-org"
import { AuthCardShell } from "@/components/auth/AuthPageShell"
import { OrganizationSetupForm } from "@/components/auth/OrganizationSetupForm"
import { SignOutButton } from "@/components/auth/SignOutButton"

export default async function SignupCompletePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  if (await userHasOrganization(user.id)) {
    redirect("/dashboard")
  }

  return (
    <AuthCardShell>
      <div className="mx-auto w-full max-w-[400px]">
        <OrganizationSetupForm />
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-center text-[13px] text-zinc-500">Wrong account?</p>
          <SignOutButton />
        </div>
      </div>
    </AuthCardShell>
  )
}
