import { Suspense } from "react"
import { createServerSupabaseClient } from "@/lib/supabase"
import { isValidShopDomain } from "@/lib/shopify"
import ShopifyAppHomePage from "./app-home/page"

function ShopifyPageFallback() {
  return (
    <div className="min-h-screen bg-[#f6f6f7] px-5 py-8 font-sans text-[#202223]">
      <div className="mx-auto w-full max-w-2xl animate-pulse space-y-5">
        <div className="space-y-2">
          <div className="h-6 w-64 rounded bg-[#e3e3e3]" />
          <div className="h-4 w-full max-w-md rounded bg-[#ececec]" />
        </div>
        <div className="h-12 rounded-lg bg-[#ecfdf3]" />
        <div className="h-72 rounded-xl bg-white" />
        <div className="h-56 rounded-xl bg-white" />
      </div>
    </div>
  )
}

async function resolveInitialConnected(shop: string | undefined): Promise<boolean> {
  const domain = (shop ?? "").trim()
  if (!isValidShopDomain(domain)) return false
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from("organizations")
      .select("shopify_access_token")
      .eq("shop_domain", domain)
      .maybeSingle()
    if (error) return false
    return Boolean(
      (data as { shopify_access_token?: string | null } | null)?.shopify_access_token,
    )
  } catch {
    return false
  }
}

export default async function ShopifyEmbeddedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const shopRaw = params.shop
  const shop = typeof shopRaw === "string" ? shopRaw : Array.isArray(shopRaw) ? shopRaw[0] : undefined
  const initialConnected = await resolveInitialConnected(shop)

  return (
    <Suspense fallback={<ShopifyPageFallback />}>
      <ShopifyAppHomePage initialConnected={initialConnected} />
    </Suspense>
  )
}
