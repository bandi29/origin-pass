import { LuxuryTemplateView } from "@/components/passport/LuxuryTemplateView"
import {
  MerchantPassportPreviewShell,
  resolveMerchantPreviewChrome,
} from "@/components/passport/merchant-passport-preview"
import { loadPublicShopPassportData } from "@/lib/public-shop-passport-data"

/**
 * Public QR short-link passport.
 * Edge-cacheable HTML via next.config Cache-Control on `/sp/*`:
 *   public, max-age=60, s-maxage=300, stale-while-revalidate=600
 * ISR revalidate keeps origin regeneration aligned with browser max-age.
 */
export const revalidate = 60

type PageProps = {
  params: Promise<{ shopSlug: string; productId: string }>
  searchParams: Promise<{ variant?: string; preview?: string; admin?: string; shop?: string; host?: string }>
}

/** Short QR entry — `/sp/{shop}/{productId}` (no query string, scannable at small sizes). */
export default async function ShortShopPassportPage({ params, searchParams }: PageProps) {
  const { shopSlug, productId } = await params
  const sp = await searchParams
  const { variant: variantId, ...previewParams } = sp

  const data = await loadPublicShopPassportData({
    shopId: shopSlug,
    productId,
    variantId,
  })

  const { showPreview, adminReturnHref } = resolveMerchantPreviewChrome({
    shopSlug,
    searchParams: previewParams,
  })

  return (
    <MerchantPassportPreviewShell showPreview={showPreview} adminReturnHref={adminReturnHref}>
      <LuxuryTemplateView data={data} />
    </MerchantPassportPreviewShell>
  )
}
