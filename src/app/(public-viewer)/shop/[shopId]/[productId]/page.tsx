import { LuxuryTemplateView } from "@/components/passport/LuxuryTemplateView"
import {
  MerchantPassportPreviewShell,
  resolveMerchantPreviewChrome,
} from "@/components/passport/merchant-passport-preview"
import { loadPublicShopPassportData } from "@/lib/public-shop-passport-data"

/**
 * Canonical long-form public passport (`/shop/{shop}/{productId}`).
 * Same SWR Cache-Control as `/sp/*` (see next.config headers).
 */
export const revalidate = 60

type PageProps = {
  params: Promise<{ shopId: string; productId: string }>
  searchParams: Promise<{ variant?: string; preview?: string; admin?: string; shop?: string; host?: string }>
}

export default async function PublicPassportPage({ params, searchParams }: PageProps) {
  const { shopId, productId } = await params
  const sp = await searchParams
  const { variant: variantId, ...previewParams } = sp
  const data = await loadPublicShopPassportData({ shopId, productId, variantId })

  const { showPreview, adminReturnHref } = resolveMerchantPreviewChrome({
    shopSlug: shopId,
    searchParams: previewParams,
  })

  return (
    <MerchantPassportPreviewShell showPreview={showPreview} adminReturnHref={adminReturnHref}>
      <LuxuryTemplateView data={data} />
    </MerchantPassportPreviewShell>
  )
}
