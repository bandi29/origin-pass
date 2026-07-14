import { LuxuryTemplateView } from "@/components/passport/LuxuryTemplateView"
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
  searchParams: Promise<{ variant?: string }>
}

/** Short QR entry — `/sp/{shop}/{productId}` (no query string, scannable at small sizes). */
export default async function ShortShopPassportPage({ params, searchParams }: PageProps) {
  const { shopSlug, productId } = await params
  const { variant: variantId } = await searchParams

  // Soft fallback payload only — never throw — so CDN SWR cannot lock onto an error shell.
  const data = await loadPublicShopPassportData({
    shopId: shopSlug,
    productId,
    variantId,
  })

  return (
    <main className="min-h-screen bg-neutral-50">
      <LuxuryTemplateView data={data} />
    </main>
  )
}
