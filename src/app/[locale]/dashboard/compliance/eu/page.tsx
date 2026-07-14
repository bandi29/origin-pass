import { redirect } from "@/i18n/navigation"
import { EU_DPP_COMPLIANCE_PATH } from "@/lib/verification-nav"

export default async function LegacyEUComplianceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect({ href: EU_DPP_COMPLIANCE_PATH, locale })
  return null
}
