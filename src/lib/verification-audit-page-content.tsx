import { PageHeader } from "@/components/layout/PageHeader"
import { AuthenticityAuditLogsClient } from "@/components/authenticity/AuthenticityAuditLogsClient"
import { requireAuth } from "@/lib/require-auth"
import { getVerificationAuditLogForUser, getOperationsAuditLogForUser } from "@/lib/audit-log-server"

export async function VerificationAuditLogsPageContent({
  initialScope,
}: {
  initialScope?: "passport_scan"
}) {
  const { user } = await requireAuth()
  const initialRows = await getVerificationAuditLogForUser(user.id, 200)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit logs"
        description="Product asset chain events — scans, passport issuance, verification reviews, and lifecycle changes."
      />
      <AuthenticityAuditLogsClient
        variant="verification"
        initialRows={initialRows}
        initialScope={initialScope}
      />
    </div>
  )
}

export async function OperationsSecurityLogsPageContent({
  initialScope,
}: {
  initialScope?: "passport_scan"
}) {
  const { user } = await requireAuth()
  const initialRows = await getOperationsAuditLogForUser(user.id, 200)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Security Logs"
        description="Organization admin trail — team access, profile and settings changes, and CSV import batches."
      />
      <AuthenticityAuditLogsClient
        variant="operations"
        initialRows={initialRows}
        initialScope={initialScope}
      />
    </div>
  )
}

/** @deprecated Use OperationsSecurityLogsPageContent */
export const OperationsAuditLogsPageContent = OperationsSecurityLogsPageContent
