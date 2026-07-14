import { Suspense } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { isValidUuid } from "@/lib/security"
import { PassportCreationWizard } from "@/components/dashboard/PassportCreationWizard"

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidUuid(id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const scoped = await getScopedProductIds(user.id)
  if (!scoped.includes(id)) notFound()

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">
          Loading editor…
        </div>
      }
    >
      <PassportCreationWizard editProductId={id} />
    </Suspense>
  )
}
