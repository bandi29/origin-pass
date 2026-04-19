import { PageHeader } from "@/components/layout/PageHeader"
import { AuthenticityGeoClient } from "@/components/authenticity/AuthenticityGeoClient"
import { requireAuth } from "@/lib/require-auth"
import { getGeoHeatForUser } from "@/lib/authenticity-server-data"

export default async function DashboardAuthenticityMapPage() {
  const { user } = await requireAuth()
  const rows = await getGeoHeatForUser(user.id)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Global activity map"
        description="Heat-style view of suspicious verification activity by region."
      />
      <AuthenticityGeoClient rows={rows} />
    </div>
  )
}
