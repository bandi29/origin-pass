import type { ReactNode } from "react"
import { ShopifyMerchantPassportPreviewBar } from "@/components/passport/ShopifyMerchantPassportPreviewBar"
import { isAdminPassportPreview } from "@/lib/public-passport-consumer"
import { buildShopifyEmbeddedAppReturnUrl } from "@/lib/shopify"

/** Normalize `/sp/{slug}` or bare shop query into a `*.myshopify.com` domain. */
export function shopDomainFromPassportContext(shopSlugOrDomain: string, shopQuery?: string | null): string {
  const raw = (shopQuery || shopSlugOrDomain || "").trim().toLowerCase()
  if (!raw) return ""
  return raw.endsWith(".myshopify.com") ? raw : `${raw.replace(/^\.+/, "")}.myshopify.com`
}

export function resolveMerchantPreviewChrome(args: {
  shopSlug: string
  searchParams: Record<string, string | string[] | undefined>
}): { showPreview: boolean; adminReturnHref: string | null } {
  const showPreview = isAdminPassportPreview(args.searchParams)
  if (!showPreview) return { showPreview: false, adminReturnHref: null }

  const shopRaw = args.searchParams.shop
  const hostRaw = args.searchParams.host
  const shopQuery = Array.isArray(shopRaw) ? shopRaw[0] : shopRaw
  const host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw
  const shopDomain = shopDomainFromPassportContext(args.shopSlug, shopQuery)
  const adminReturnHref = shopDomain
    ? buildShopifyEmbeddedAppReturnUrl(shopDomain, host ?? "")
    : null

  return { showPreview: true, adminReturnHref }
}

export function MerchantPassportPreviewShell({
  showPreview,
  adminReturnHref,
  children,
}: {
  showPreview: boolean
  adminReturnHref: string | null
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-neutral-50">
      {showPreview ? <ShopifyMerchantPassportPreviewBar adminReturnHref={adminReturnHref} /> : null}
      {children}
    </main>
  )
}
