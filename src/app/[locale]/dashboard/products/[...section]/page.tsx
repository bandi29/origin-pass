import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { isValidUuid } from "@/lib/security"
import { ProductDetailOverview } from "@/components/dashboard/ProductDetailOverview"

const sections: Record<string, string> = {
  "create-product": "Create and validate new product records.",
  "import-products": "Bulk import product catalog data.",
}

const PRODUCT_TABS = [
  { key: "product-info", label: "Product Info" },
  { key: "passport-template", label: "Passport Template" },
  { key: "qr-codes", label: "QR Codes" },
  { key: "scan-history", label: "Scan History" },
] as const

export default async function ProductSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params

  if (section.length >= 1 && !sections[section[0]]) {
    const productId = section[0]
    if (!isValidUuid(productId)) notFound()

    const sub = section[1] ?? "product-info"
    const validSub = new Set<string>(PRODUCT_TABS.map((t) => t.key))
    if (!validSub.has(sub)) notFound()

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) notFound()

    const scoped = await getScopedProductIds(user.id)
    if (!scoped.includes(productId)) notFound()

    const { data: product, error: productError } = await supabase
      .from("products")
      .select(
        "name, sku, created_at, is_archived, origin, materials, metadata, compliance_data, compliance_category_key",
      )
      .eq("id", productId)
      .maybeSingle()

    if (productError || !product) notFound()

    const [{ count: passportCount }, { data: passportRows }, { count: batchCount }, { data: latestBatch }] =
      await Promise.all([
        supabase.from("passports").select("*", { count: "exact", head: true }).eq("product_id", productId),
        supabase.from("passports").select("id").eq("product_id", productId),
        supabase
          .from("batches")
          .select("*", { count: "exact", head: true })
          .eq("product_id", productId)
          .eq("is_active", true),
        supabase
          .from("batches")
          .select("artisan_name, production_run_name, location")
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const passportIds = (passportRows ?? []).map((r) => r.id).filter(Boolean)
    let scanCount = 0
    if (passportIds.length > 0) {
      const { count: sc } = await supabase
        .from("passport_scans")
        .select("*", { count: "exact", head: true })
        .in("passport_id", passportIds)
      scanCount = sc ?? 0
    }

    return (
      <div className={spacing.pageStack}>
        <ProductDetailOverview
          productId={productId}
          product={product}
          metrics={{
            passportCount: passportCount ?? 0,
            scanCount,
            activeBatchCount: batchCount ?? 0,
          }}
          latestBatch={latestBatch}
          sub={sub}
          tabs={[...PRODUCT_TABS]}
        />
      </div>
    )
  }

  const key = section[0]
  return (
    <div className={spacing.pageStack}>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        {key.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
      </h1>
      <p className="text-slate-600 dark:text-slate-300">{sections[key]}</p>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        Products module placeholder.
      </div>
    </div>
  )
}
