import { redirect } from "@/i18n/navigation"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export default async function DashboardVerificationAuditRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ event?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  const qs = sp.event ? `?event=${encodeURIComponent(sp.event)}` : ""
  redirect({ href: `${VERIFICATION_ROUTES.audit}${qs}`, locale })
  return null
}
