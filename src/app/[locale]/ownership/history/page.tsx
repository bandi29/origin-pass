import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { getOwnershipByOwner } from "@/backend/modules/ownership/service"
import { OwnershipHistoryClient } from "@/components/ownership/OwnershipHistoryClient"

type PageProps = { params: Promise<{ locale: string }> }

export default async function OwnershipHistoryPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email

  if (!email) {
    redirect({
      href: {
        pathname: "/login",
        query: { next: `/${locale}/ownership/history` },
      },
      locale,
    })
    return null
  }

  const records = await getOwnershipByOwner(email)

  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${spacing.main}`}>
      <NarrowContainer className="max-w-6xl">
        <div className={`mx-auto max-w-2xl ${spacing.stackDense}`}>
          <SimplePageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Ownership history" },
            ]}
          />
          <PageHeader
            title="Your claimed products"
            description="Products you have registered ownership for."
          />
          <OwnershipHistoryClient initialRecords={records} />
        </div>
      </NarrowContainer>
    </main>
  )
}
