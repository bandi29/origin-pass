import { Activity, BookOpen, Layers, Plus } from "lucide-react"
import { Link } from "@/i18n/navigation"
import clsx from "clsx"

export type ProductDetailModel = {
  name?: string | null
  sku?: string | null
  created_at?: string | null
  is_archived?: boolean | null
  origin?: string | null
  materials?: string | null
  metadata?: Record<string, unknown> | null
  compliance_data?: Record<string, unknown> | null
  compliance_category_key?: string | null
}

export type ProductDetailMetrics = {
  passportCount: number
  scanCount: number
  activeBatchCount: number
}

export type LatestBatchSummary = {
  artisan_name?: string | null
  production_run_name?: string | null
  location?: string | null
} | null

function formatCreatedDate(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function pickText(...candidates: unknown[]) {
  for (const c of candidates) {
    if (c == null) continue
    const s = String(c).trim()
    if (s) return s
  }
  return "—"
}

function buildPrimaryMaterial(product: ProductDetailModel, cd: Record<string, unknown>) {
  return pickText(
    product?.materials,
    cd.primary_material_descriptor,
    cd.fiber_composition,
    cd.wood_species,
    cd.materials_disclosure,
  )
}

function buildLiningHardware(meta: Record<string, unknown>, cd: Record<string, unknown>) {
  return pickText(meta.lining_hardware, meta.lining_or_hardware, meta.hardware, cd.finishing_notes)
}

function buildProductionLocation(product: ProductDetailModel, meta: Record<string, unknown>, cd: Record<string, unknown>, batch: LatestBatchSummary) {
  const fromMeta = [meta.originRegion, meta.originCountry].filter((x) => x != null && String(x).trim() !== "").join(", ")
  return pickText(product?.origin, fromMeta, cd.origin_country, batch?.location)
}

function buildArtisanWorkshop(meta: Record<string, unknown>, batch: LatestBatchSummary) {
  const workshop = pickText(meta.workshop_code, meta.artisan_id, meta.workshop_id)
  if (workshop !== "—") return workshop
  const fromBatch = [batch?.artisan_name, batch?.production_run_name].filter((x) => x != null && String(x).trim() !== "").join(" · ")
  return fromBatch || "—"
}

function buildHsCode(meta: Record<string, unknown>, cd: Record<string, unknown>) {
  return pickText(cd.hs_code, cd.tariff_hs_code, cd.customs_tariff_code, meta.hs_code, meta.tariff_code)
}

function buildCircularity(cd: Record<string, unknown>) {
  const pct = cd.recycled_content_percentage
  if (pct != null && String(pct).trim() !== "") {
    return `${String(pct).trim()}% recycled content (declared)`
  }
  return pickText(cd.circularity_statement, cd.end_of_life_circularity, cd.circularity_claim)
}

function buildCarbon(cd: Record<string, unknown>) {
  const raw = cd.carbon_footprint_kg_co2e ?? cd.estimated_carbon_kg_co2e ?? cd.carbon_footprint
  if (raw == null || String(raw).trim() === "") return "—"
  const s = String(raw).trim()
  if (/co2e/i.test(s)) return s
  return `${s} kg CO₂e`
}

function buildDppStatus(product: ProductDetailModel, passportCount: number) {
  const key = product?.compliance_category_key?.trim()
  if (passportCount > 0 && key) {
    return `Passport linked · ${key} compliance profile`
  }
  if (passportCount > 0) return "Digital passport on file"
  if (key) return `Catalog profile · ${key} (issue passport when ready)`
  return "Complete compliance profile & passport to go live"
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof BookOpen
  label: string
  value: number
  suffix: string
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900">
          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
            {value}
            <span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">{suffix}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

type Tab = { key: string; label: string }

export function ProductDetailOverview({
  productId,
  product,
  metrics,
  latestBatch,
  sub,
  tabs,
}: {
  productId: string
  product: ProductDetailModel
  metrics: ProductDetailMetrics
  latestBatch: LatestBatchSummary
  sub: string
  tabs: Tab[]
}) {
  const meta = (product?.metadata ?? {}) as Record<string, unknown>
  const cd = (product?.compliance_data ?? {}) as Record<string, unknown>
  const rawName = product?.name?.trim()
  const title = rawName && rawName.length > 0 ? rawName : "Untitled product"
  const sku = product?.sku?.trim() ? product.sku.trim() : null
  const isActive = !product?.is_archived
  const primaryMaterial = buildPrimaryMaterial(product, cd)
  const lining = buildLiningHardware(meta, cd)
  const productionLoc = buildProductionLocation(product, meta, cd, latestBatch)
  const artisanLine = buildArtisanWorkshop(meta, latestBatch)
  const hs = buildHsCode(meta, cd)
  const circularity = buildCircularity(cd)
  const carbon = buildCarbon(cd)
  const dpp = buildDppStatus(product, metrics.passportCount)

  const editHref = `/dashboard/products/passport-wizard?step=1&flow=compliance&productId=${encodeURIComponent(productId)}`
  const passportHref = `/dashboard/products/passport-wizard?step=2&flow=compliance&productId=${encodeURIComponent(productId)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              SKU: {sku ?? "N/A"}
            </span>
            <span
              className={clsx(
                "rounded-full border px-2 py-1 text-xs font-semibold",
                isActive
                  ? "border-emerald-200/50 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {isActive ? "Active" : "Archived"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Created {formatCreatedDate(product?.created_at ?? null)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Link
            href={editHref}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Edit Product
          </Link>
          <Link
            href={passportHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Generate Passport
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={BookOpen} label="Linked Passports" value={metrics.passportCount} suffix="Passports" />
        <KpiCard icon={Activity} label="Total Scans" value={metrics.scanCount} suffix="Scans" />
        <KpiCard icon={Layers} label="Active Batches" value={metrics.activeBatchCount} suffix="Batches" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/dashboard/products/${productId}/${tab.key}`}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-sm transition",
              sub === tab.key
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {sub === "product-info" ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Material &amp; Craftsmanship</h2>
            <dl className="mt-2">
              <SpecRow label="Primary Material" value={primaryMaterial} />
              <SpecRow label="Lining / Hardware" value={lining} />
              <SpecRow label="Production Location" value={productionLoc} />
              <SpecRow label="Artisan ID / Workshop Code" value={artisanLine} />
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Regulatory &amp; Compliance (DPP)</h2>
            <dl className="mt-2">
              <SpecRow label="Tariff / HS Code" value={hs} />
              <SpecRow label="Circularity Info" value={circularity} />
              <SpecRow label="Carbon Footprint" value={carbon} />
              <SpecRow label="Digital Passport Status" value={dpp} />
            </dl>
          </section>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          {tabs.find((t) => t.key === sub)?.label ?? sub}: module view — use Product Info for the full catalog overview.
        </div>
      )}
    </div>
  )
}
