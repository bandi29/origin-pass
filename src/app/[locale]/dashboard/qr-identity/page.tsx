import { redirect } from "@/i18n/navigation"
import { QR_IDENTITY_LOG_DIRECTORY_PATH } from "@/lib/qr-identity-nav"

export default async function QRIdentityIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const query = await searchParams
  const preview = typeof query.preview === "string" ? query.preview : null
  const href = preview
    ? `${QR_IDENTITY_LOG_DIRECTORY_PATH}?preview=${encodeURIComponent(preview)}`
    : QR_IDENTITY_LOG_DIRECTORY_PATH

  redirect({ href, locale })
  return null
}
