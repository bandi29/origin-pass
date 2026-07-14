import { OperationsSecurityLogsPageContent } from "@/lib/verification-audit-page-content"

export default async function OperationsSecurityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const params = await searchParams
  const initialScope = params.event === "passport_scan" ? ("passport_scan" as const) : undefined
  return <OperationsSecurityLogsPageContent initialScope={initialScope} />
}
