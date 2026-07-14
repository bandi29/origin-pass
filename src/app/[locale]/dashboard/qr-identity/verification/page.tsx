import { PageHeader } from "@/components/layout/PageHeader"
import { AuthenticityOverviewClient } from "@/components/authenticity/AuthenticityOverviewClient"
import { requireAuth } from "@/lib/require-auth"
import { getAuthenticityOverviewData } from "@/lib/authenticity-server-data"

export default async function QRIdentityVerificationPage() {
  const { user } = await requireAuth()
  const data = await getAuthenticityOverviewData(user.id)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security Verification"
        description="Monitor scan integrity, fraud signals, and verification outcomes for QR-linked product identities."
        contextBadge="QR Identity · Verification"
      />
      <AuthenticityOverviewClient
        metrics={data.metrics}
        verificationRows={data.rows}
        scansByProductId={data.scansByProductId}
      />
    </div>
  )
}
