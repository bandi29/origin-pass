import { redirect } from "@/i18n/navigation"
import { QR_IDENTITY_LOG_DIRECTORY_PATH } from "@/lib/qr-identity-nav"

export default async function ProductIdentityQrIdentityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect({ href: QR_IDENTITY_LOG_DIRECTORY_PATH, locale })
  return null
}
