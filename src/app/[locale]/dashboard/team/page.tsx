import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { FadeIn } from "@/components/layout/FadeIn"
import { PageHeader } from "@/components/layout/PageHeader"
import { TeamsDashboardGate } from "@/components/dashboard/team/TeamsDashboardGate"

type PageProps = { params: Promise<{ locale: string }> }

/**
 * Team data is loaded in the browser via `/api/team/data` so this segment resolves quickly.
 * A slow or hanging Supabase admin chain on the server previously left the prior dashboard page visible
 * while the sidebar showed Team as active.
 */
export default async function DashboardTeamPage({ params }: PageProps) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect({
      href: { pathname: "/login", query: { next: `/${locale}/dashboard/team` } },
      locale,
    })
    return null
  }

  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader title="Team" description="Members, invitations, roles, activity, and security settings." />
      <TeamsDashboardGate />
    </FadeIn>
  )
}
