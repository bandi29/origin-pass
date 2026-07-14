import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { createClient } from "@/lib/supabase/server"
import { BatchDistributionCenterClient } from "@/components/dashboard/BatchDistributionCenterClient"

const primaryBtn =
  "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"

type BatchRow = {
  id: string
  created_at: string | null
  product_id: string | null
  product: { name?: string | null } | { name?: string | null }[] | null
}

export default async function QRIdentityBatchPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from("batches")
    .select("*, product:products(name)")
    .eq("brand_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30)

  const batchRows = (data ?? []) as BatchRow[]
  const batchIds = batchRows.map((r) => r.id)

  const productIdsForPassports = [
    ...new Set(
      batchRows.map((r) => r.product_id).filter((id): id is string => Boolean(id)),
    ),
  ]
  const passportByProduct = new Map<string, string>()
  if (productIdsForPassports.length > 0) {
    const { data: passList } = await supabase
      .from("passports")
      .select("id, product_id, created_at")
      .in("product_id", productIdsForPassports)
      .eq("status", "active")
      .order("created_at", { ascending: true })
    for (const pr of passList ?? []) {
      const pid = (pr as { product_id: string }).product_id
      const passportId = (pr as { id: string }).id
      if (!passportByProduct.has(pid)) passportByProduct.set(pid, passportId)
    }
  }

  const itemCounts = new Map<string, number>()
  if (batchIds.length > 0) {
    const { data: items } = await supabase
      .from("items")
      .select("batch_id")
      .in("batch_id", batchIds)
      .eq("brand_id", user.id)

    for (const item of items ?? []) {
      const batchId = (item as { batch_id?: string }).batch_id
      if (!batchId) continue
      itemCounts.set(batchId, (itemCounts.get(batchId) ?? 0) + 1)
    }
  }

  const rows = batchRows.map((row) => {
    const productName =
      (Array.isArray(row.product) ? row.product[0]?.name : row.product?.name) ?? null
    return {
      id: row.id,
      createdAt: row.created_at,
      quantity: itemCounts.get(row.id) ?? 0,
      productId: row.product_id,
      productName,
      previewPassportId: row.product_id
        ? passportByProduct.get(row.product_id) ?? null
        : null,
    }
  })

  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Batch QR generation"
        description="Generate multiple QR codes for a product batch."
        contextBadge="Dashboard · QR Identity"
        actions={
          <Link href="/dashboard/batches?context=qr-identity" className={primaryBtn}>
            Create batch
          </Link>
        }
      />

      <BatchDistributionCenterClient rows={rows} />
    </div>
  )
}
