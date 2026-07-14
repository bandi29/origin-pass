import { redirect } from "@/i18n/navigation"
import { OPERATIONS_SECURITY_LOGS_PATH } from "@/lib/verification-nav"

export default async function LegacyOperationsAuditLogsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ event?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  const qs = sp.event ? `?event=${encodeURIComponent(sp.event)}` : ""
  redirect({ href: `${OPERATIONS_SECURITY_LOGS_PATH}${qs}`, locale })
  return null
}
