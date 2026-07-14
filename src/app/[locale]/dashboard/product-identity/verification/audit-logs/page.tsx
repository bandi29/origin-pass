import { VerificationAuditLogsPageContent } from "@/lib/verification-audit-page-content"

export default async function ProductIdentityVerificationAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const params = await searchParams
  const initialScope = params.event === "passport_scan" ? ("passport_scan" as const) : undefined
  return <VerificationAuditLogsPageContent initialScope={initialScope} />
}
