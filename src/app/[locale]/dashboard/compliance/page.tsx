import { redirect } from "@/i18n/navigation"
import { OPERATIONS_COMPLIANCE_HUB_PATH } from "@/lib/verification-nav"

export default async function LegacyComplianceHubRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect({ href: OPERATIONS_COMPLIANCE_HUB_PATH, locale })
  return null
}
