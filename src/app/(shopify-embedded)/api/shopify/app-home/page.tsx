"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, ChevronRight, Loader2, Package, RefreshCw } from "lucide-react"
import { PrintLabelSheet, type LabelFormat } from "@/components/passport/PrintLabelSheet"
import { useShopifyContextualSave } from "@/app/(shopify-embedded)/ShopifyContextualSaveBar"
import { ShopifyAppTitleBar } from "@/app/(shopify-embedded)/ShopifyAppTitleBar"
import { ComplianceFAQ } from "@/components/ComplianceFAQ"
import { OnboardingGuide } from "@/components/OnboardingGuide"
import { CertificateField } from "./CertificateField"
import { EvidenceUpgradeBanner } from "./EvidenceUpgradeBanner"
import { MerchantCatalogEmptyState } from "./MerchantCatalogEmptyState"
import { PlanManagementCard } from "./PlanManagementCard"
import { ProductEvidenceIndicators } from "./ProductEvidenceIndicators"
import { shouldShowMerchantEmptyState } from "./merchant-empty-state"
import type { PaidPlan } from "@/lib/shopify-billing"
import {
  computeBrandDefaultCoverage,
  computeComplianceHealth,
  productHasConflict,
  productIsAuditReady,
} from "@/lib/field-lineage"
import {
  shopifyEmbeddedProductEditorHref,
} from "@/lib/shopify-embedded-url"
import {
  getShopifySyncProgress,
  getStoreConfig,
  isStoreConnected,
  listStoreProducts,
  syncStoreProducts,
  updateStoreConfig,
  type PrintableProduct,
  type StoreConfigState,
} from "./actions"

/** App Bridge session token; undefined when not in an embedded context. */
async function getSessionToken(): Promise<string | undefined> {
  if (typeof window === "undefined" || !window.shopify) return undefined
  try {
    return await window.shopify.idToken()
  } catch {
    return undefined
  }
}

const PRODUCTION_MAX = 120
const CARE_MAX = 500

const emptySaveState: StoreConfigState = {
  ok: false,
  message: "",
  productionLocation: "",
  careInstructions: "",
}

const SAVE_BAR_ID = "store-config-save-bar"

const LABEL_FORMAT_OPTIONS: { value: LabelFormat; label: string }[] = [
  { value: "avery5160", label: "Avery Sheet" },
  { value: "thermal", label: "Thermal Roll Printer" },
]

/** "just now" / "12 minutes ago" / "3 hours ago" / "2 days ago" — sync freshness. */
function relativeTimeFromNow(iso: string): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ""
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

const cardClass = "rounded-xl border border-[#e3e3e3] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.05)]"

/** Consistent, crisp keyboard focus ring for every interactive admin control (A11y). */
const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1"

/**
 * Cold-start skeleton for the product index — admin-native shimmer placeholders
 * (Polaris-skeleton equivalent; Polaris React is not installed in this stack)
 * instead of a raw "Loading…" line. Mirrors the real row layout so there is no
 * layout shift when data lands.
 */
function CatalogLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading catalog" className="space-y-3">
      <span className="sr-only">Loading catalog…</span>
      <div className="h-9 animate-pulse rounded-lg bg-[#f1f2f3]" aria-hidden />
      <div className="rounded-lg border border-[#e3e3e3] bg-white" aria-hidden>
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className={`flex animate-pulse items-center gap-3 px-3 py-3 ${row < 3 ? "border-b border-[#ebebeb]" : ""}`}
            style={{ animationDelay: `${row * 120}ms` }}
          >
            <div className="h-4 w-4 shrink-0 rounded bg-[#f1f2f3]" />
            <div className="h-10 w-10 shrink-0 rounded-md bg-[#f1f2f3]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-1/3 rounded bg-[#f1f2f3]" />
              <div className="h-3 w-1/2 rounded bg-[#ececec]" />
            </div>
            <div className="h-7 w-14 shrink-0 rounded-lg bg-[#f1f2f3]" />
            <div className="h-8 w-16 shrink-0 rounded-md bg-[#f1f2f3]" />
          </div>
        ))}
      </div>
    </div>
  )
}

const fieldClass =
  "w-full rounded-lg border border-[#c9cccf] bg-white px-3.5 py-2.5 text-sm text-[#202223] placeholder:text-[#8c9196] outline-none transition-shadow focus:border-black focus:ring-1 focus:ring-black"

/** Fixed 40×40 canvas — Shopify thumbnails scale with object-contain (no crop/squish). */
function ProductListThumbnail({
  imageUrl,
  title,
}: {
  imageUrl: string | null
  title: string
}) {
  return (
    <div className="relative aspect-square h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-100 bg-slate-50">
      {imageUrl ? (
        // Lazy: the catalog can hold 300 rows — don't fetch offscreen thumbnails.
        <img src={imageUrl} alt={title} loading="lazy" decoding="async" className="h-full w-full object-contain p-0.5" />
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-hidden>
          <Package className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}

/**
 * Memoized catalog row — with ~300 products, re-rendering every row on each
 * config-field keystroke (all page state lives in one component) is the page's
 * hottest client path. Props are primitives + stable callbacks so React.memo
 * short-circuits unless this row's own data changed.
 */
const CatalogProductRow = memo(function CatalogProductRow({
  product,
  isLast,
  isSelected,
  quantity,
  editorHref,
  passportHref,
  onToggle,
  onQuantityChange,
}: {
  product: PrintableProduct
  isLast: boolean
  isSelected: boolean
  quantity: number
  editorHref: string
  /** Public consumer passport URL (same destination as the printed QR). */
  passportHref: string
  onToggle: (id: string) => void
  onQuantityChange: (id: string, raw: number) => void
}) {
  return (
    <li className={isLast ? undefined : "border-b border-[#ebebeb]"}>
      {/* flex-wrap + full-width label below `sm` — Edit/Qty drop to their own
          line on phones instead of colliding with the lineage chips. */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-[#f6f6f7]">
        <label className="flex min-w-full flex-1 cursor-pointer items-center gap-3 sm:min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(product.id)}
            className="h-4 w-4 shrink-0 rounded border-[#c9cccf] text-[#202223] focus:ring-1 focus:ring-black"
          />
          <ProductListThumbnail imageUrl={product.imageUrl} title={product.title} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[#202223]">{product.title}</p>
            {product.sku ? <p className="truncate text-xs text-[#8c9196]">{product.sku}</p> : null}
            <div className="mt-1.5">
              <ProductEvidenceIndicators
                evidence={{
                  productionLocation: product.lineage.productionLocation,
                  careInstructions: product.lineage.careInstructions,
                }}
                brandCerts={product.lineage.brandCerts}
              />
            </div>
          </div>
        </label>
        <a
          href={passportHref}
          className={`inline-flex shrink-0 items-center rounded-lg border border-[#c9cccf] bg-white px-2.5 py-1.5 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7] ${focusRingClass}`}
        >
          View passport
        </a>
        <a
          href={editorHref}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#c9cccf] bg-white px-2.5 py-1.5 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7] ${focusRingClass}`}
        >
          Edit
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </a>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <label htmlFor={`qty-${product.id}`} className="text-[10px] font-medium uppercase tracking-wide text-[#8c9196]">
            Qty
          </label>
          <input
            id={`qty-${product.id}`}
            type="number"
            min={1}
            max={999}
            value={quantity}
            onChange={(e) => onQuantityChange(product.id, Number(e.target.value))}
            className="w-16 rounded-md border border-[#c9cccf] bg-white px-2 py-1 text-center text-sm text-[#202223] outline-none transition focus:border-black focus:ring-1 focus:ring-black"
          />
        </div>
      </div>
    </li>
  )
})

/**
 * Embedded admin home — single-screen store configuration + label printing.
 * Renders inside the Shopify admin iframe (App Bridge).
 */
export default function ShopifyAppHomePage() {
  const searchParams = useSearchParams()
  const shop = searchParams.get("shop") ?? ""
  const host = searchParams.get("host") ?? ""
  /** Recording/storyboard only: pretend catalog is empty until the first Sync in this session. */
  const storyboardFresh = searchParams.get("storyboard") === "fresh"
  const [freshUnlocked, setFreshUnlocked] = useState(!storyboardFresh)

  const connectUrl = useMemo(() => {
    if (!shop) return ""
    const params = new URLSearchParams({ shop })
    if (host) params.set("host", host)
    return `/api/shopify/auth?${params.toString()}`
  }, [shop, host])

  const embedParams = useMemo(
    () => ({
      embedded: searchParams.get("embedded"),
      shop,
      host,
    }),
    [searchParams, shop, host],
  )

  const productEditorHref = useCallback(
    (productId: string) => shopifyEmbeddedProductEditorHref(productId, embedParams),
    [embedParams],
  )

  const [saveState, setSaveState] = useState<StoreConfigState>(emptySaveState)
  const [saving, setSaving] = useState(false)
  const [connected, setConnected] = useState(false)
  const [location, setLocation] = useState("")
  const [instructions, setInstructions] = useState("")
  // Last-saved snapshot — powers real dirty detection + Discard.
  const [savedLocation, setSavedLocation] = useState("")
  const [savedInstructions, setSavedInstructions] = useState("")
  const [products, setProducts] = useState<PrintableProduct[]>([])
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [connectionLoaded, setConnectionLoaded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showSheet, setShowSheet] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncPercent, setSyncPercent] = useState(0)
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const syncInFlightRef = useRef(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [conflictFilter, setConflictFilter] = useState(false)
  const [labelFormat, setLabelFormat] = useState<LabelFormat>("avery5160")
  // Server-side catalog search + pagination ("Showing X of Y" + Load more).
  const [catalogSearch, setCatalogSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  // Billing tier — gates evidence uploads in the UI (server enforces too).
  const [subscriptionTier, setSubscriptionTier] = useState<"free" | "grower" | "enterprise">("free")
  const [upgrading, setUpgrading] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  // Every product ever loaded this session, by id — selections keep printing even
  // when a search narrows the visible page.
  const productCacheRef = useRef(new Map<string, PrintableProduct>())
  const oauthRedirectStartedRef = useRef(false)
  const cancelPollRef = useRef<number | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(catalogSearch.trim()), 300)
    return () => window.clearTimeout(t)
  }, [catalogSearch])

  const loadProducts = useCallback(
    async (offset = 0) => {
      if (!shop) {
        setProductsLoaded(true)
        return
      }
      if (offset > 0) setLoadingMore(true)
      try {
        const sessionToken = await getSessionToken()
        const page = await listStoreProducts(shop, { sessionToken, search: debouncedSearch, offset })
        for (const product of page.products) productCacheRef.current.set(product.id, product)
        setCatalogTotal(page.totalCount)
        setProducts((prev) => (offset === 0 ? page.products : [...prev, ...page.products]))
      } finally {
        setProductsLoaded(true)
        setLoadingMore(false)
      }
    },
    [shop, debouncedSearch],
  )

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  useEffect(() => {
    setQuantities((prev) => {
      const next = { ...prev }
      for (const product of products) {
        if (next[product.id] == null) next[product.id] = 1
      }
      return next
    })
  }, [products])

  useEffect(() => {
    // Prune stale selections only when the FULL catalog is loaded — while a search
    // or pagination narrows the loaded page, off-page selections must survive.
    if (debouncedSearch || products.length < catalogTotal) return
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const validIds = new Set(products.map((p) => p.id))
      const next = new Set([...prev].filter((id) => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [products, debouncedSearch, catalogTotal])

  useEffect(() => {
    if (showSheet && selected.size === 0) setShowSheet(false)
  }, [showSheet, selected.size])

  useEffect(() => {
    if (!shop) return
    let active = true
    getSessionToken()
      .then((token) => isStoreConnected(shop, token))
      .then((ok) => {
        if (!active) return
        setConnected(ok)
      })
      .finally(() => {
        if (active) setConnectionLoaded(true)
      })
    return () => {
      active = false
    }
  }, [shop])

  // App Store 1.2.1 / 2.3.2: unauthenticated app-home must start OAuth immediately —
  // no interactive "Link catalog" gate. Escape the Admin iframe via top-level navigation.
  useEffect(() => {
    if (!connectionLoaded || connected || !shop || !connectUrl) return
    if (oauthRedirectStartedRef.current) return
    oauthRedirectStartedRef.current = true
    try {
      const opened = window.open(connectUrl, "_top")
      if (opened !== null || window.shopify) return
    } catch {
      // fall through
    }
    try {
      ;(window.top ?? window).location.href = connectUrl
    } catch {
      // If navigation is blocked, the non-interactive connecting UI remains visible.
    }
  }, [connectionLoaded, connected, shop, connectUrl])

  useEffect(() => {
    return () => {
      if (cancelPollRef.current != null) window.clearInterval(cancelPollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!shop) return
    let active = true
    getSessionToken()
      .then((token) => getStoreConfig(shop, token))
      .then((data) => {
        if (!active) return
        setLocation(data.productionLocation)
        setInstructions(data.careInstructions)
        setSavedLocation(data.productionLocation)
        setSavedInstructions(data.careInstructions)
        setLastSyncedAt(data.lastSyncedAt)
        setSubscriptionTier(data.subscriptionTier)
      })
      .finally(() => {
        if (active) setConfigLoaded(true)
      })
    return () => {
      active = false
    }
  }, [shop])

  // Real dirty state drives the App Bridge contextual save bar show/hide.
  const isDirty = location !== savedLocation || instructions !== savedInstructions

  const handleSave = useCallback(async () => {
    if (!shop || saving) return
    setSaving(true)
    try {
      const sessionToken = await getSessionToken()
      const result = await updateStoreConfig({
        shop,
        sessionToken,
        productionLocation: location,
        careInstructions: instructions,
      })
      setSaveState(result)
      if (result.ok) {
        setSavedLocation(result.productionLocation)
        setSavedInstructions(result.careInstructions)
        setLocation(result.productionLocation)
        setInstructions(result.careInstructions)
        window.shopify?.toast.show("Configuration saved")
      } else {
        window.shopify?.toast.show(result.message || "Could not save configuration", { isError: true })
      }
    } finally {
      setSaving(false)
    }
  }, [shop, saving, location, instructions])

  const handleDiscard = useCallback(() => {
    setLocation(savedLocation)
    setInstructions(savedInstructions)
    setSaveState(emptySaveState)
  }, [savedLocation, savedInstructions])

  const { nativeSaveBarActive } = useShopifyContextualSave({
    id: SAVE_BAR_ID,
    isDirty,
    saving,
    onSave: handleSave,
    onDiscard: handleDiscard,
  })

  // Storyboard `?storyboard=fresh` hides the catalog until Sync runs (first-install demo).
  const uiProducts = freshUnlocked ? products : []
  const uiCatalogTotal = freshUnlocked ? catalogTotal : 0

  // Resolve from the session cache so selections made before a search/pagination
  // change still print, even when not in the currently visible page.
  const selectedProducts = useMemo(
    () =>
      [...selected]
        .map((id) => productCacheRef.current.get(id))
        .filter((p): p is PrintableProduct => Boolean(p)),
    // `products` refreshes cached identities after a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, products, freshUnlocked],
  )
  const sheetProducts = useMemo(
    () =>
      selectedProducts.map((p) => ({
        ...p,
        quantity: Math.min(999, Math.max(1, quantities[p.id] ?? 1)),
      })),
    [selectedProducts, quantities],
  )
  const canExportLabels = selectedProducts.length > 0

  const brandCoverage = useMemo(() => computeBrandDefaultCoverage(uiProducts), [uiProducts])
  const complianceHealth = useMemo(() => computeComplianceHealth(uiProducts), [uiProducts])
  const storeWideBrandCertCount = useMemo(() => {
    if (uiProducts.length === 0) return 0
    const brandCerts = uiProducts[0].lineage.brandCerts
    return (brandCerts.productionLocation ? 1 : 0) + (brandCerts.careInstructions ? 1 : 0)
  }, [uiProducts])
  const missingBrandEvidence = storeWideBrandCertCount === 0
  // "Review" surfaces everything not audit-ready: conflicts AND awaiting-evidence
  // products (matches all buckets the compliance banner counts).
  const visibleProducts = useMemo(
    () =>
      conflictFilter
        ? uiProducts.filter((p) => productHasConflict(p.lineage) || !productIsAuditReady(p.lineage))
        : uiProducts,
    [uiProducts, conflictFilter],
  )
  const allSelected =
    visibleProducts.length > 0 && visibleProducts.every((p) => selected.has(p.id))

  const initialDataLoaded = productsLoaded && configLoaded && connectionLoaded
  const showMerchantEmptyState = useMemo(
    () =>
      initialDataLoaded &&
      shouldShowMerchantEmptyState(uiProducts.length, {
        connected,
        productionLocation: savedLocation,
        careInstructions: savedInstructions,
      }),
    [initialDataLoaded, uiProducts.length, connected, savedLocation, savedInstructions],
  )

  // Stable identity (functional setState) so memoized rows skip re-renders.
  const setProductQuantity = useCallback((id: string, raw: number) => {
    const quantity = Math.min(999, Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1))
    setQuantities((prev) => ({ ...prev, [id]: quantity }))
  }, [])

  // Bulk quantity: one value applied to every loaded product.
  const [qtyAll, setQtyAll] = useState("1")
  const applyQuantityToAll = useCallback(() => {
    const parsed = Number(qtyAll)
    const quantity = Math.min(999, Math.max(1, Number.isFinite(parsed) ? Math.floor(parsed) : 1))
    setQuantities((prev) => {
      const next = { ...prev }
      for (const product of products) next[product.id] = quantity
      return next
    })
  }, [qtyAll, products])

  function handleProceedToSync() {
    document.getElementById("catalog-sync-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Stable identity (functional setState) so memoized rows skip re-renders.
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const billingEndpoint = useMemo(() => {
    if (!shop) return ""
    return `/api/shopify/billing?shop=${encodeURIComponent(shop)}${host ? `&host=${encodeURIComponent(host)}` : ""}`
  }, [shop, host])

  const openConfirmationUrl = useCallback((confirmationUrl: string): boolean => {
    try {
      const opened = window.open(confirmationUrl, "_top")
      if (opened !== null || window.shopify) return true
    } catch {
      // fall through
    }
    try {
      ;(window.top ?? window).location.href = confirmationUrl
      return true
    } catch {
      return false
    }
  }, [])

  const refreshSubscriptionTier = useCallback(async () => {
    if (!shop) return
    const token = await getSessionToken()
    const data = await getStoreConfig(shop, token)
    setSubscriptionTier(data.subscriptionTier)
    return data.subscriptionTier
  }, [shop])

  // Start a Shopify Billing upgrade: create the recurring charge, then send the
  // TOP window to Shopify's confirmation page (billing approval cannot run
  // inside the app iframe). The tier flips only via the approval webhook.
  const handleUpgrade = useCallback(
    async (plan: PaidPlan) => {
      if (!shop || !billingEndpoint || upgrading || billingBusy) return
      setUpgrading(true)
      setBillingBusy(true)
      try {
        const token = await getSessionToken()
        const res = await fetch(billingEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action: "upgrade", plan }),
        })
        const data = (await res.json().catch(() => null)) as
          | { ok: boolean; confirmationUrl?: string; message?: string }
          | null
        if (!res.ok || !data?.ok || !data.confirmationUrl) {
          window.shopify?.toast.show(data?.message ?? "Could not start the upgrade. Try again.", { isError: true })
          return
        }
        if (!openConfirmationUrl(data.confirmationUrl)) {
          window.shopify?.toast.show("Popup blocked — click Upgrade again to open Shopify billing.", {
            isError: true,
          })
        }
      } catch {
        window.shopify?.toast.show("Could not start the upgrade. Try again.", { isError: true })
      } finally {
        setUpgrading(false)
        setBillingBusy(false)
      }
    },
    [shop, billingEndpoint, upgrading, billingBusy, openConfirmationUrl],
  )

  const handleSwitch = useCallback(
    async (plan: PaidPlan) => {
      if (!shop || !billingEndpoint || billingBusy) return
      setBillingBusy(true)
      try {
        const token = await getSessionToken()
        const res = await fetch(billingEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action: "switch", plan }),
        })
        const data = (await res.json().catch(() => null)) as
          | { ok: boolean; confirmationUrl?: string; message?: string }
          | null
        if (!res.ok || !data?.ok || !data.confirmationUrl) {
          window.shopify?.toast.show(data?.message ?? "Could not switch plans. Try again.", { isError: true })
          return
        }
        if (!openConfirmationUrl(data.confirmationUrl)) {
          window.shopify?.toast.show("Popup blocked — try Switch again to open Shopify billing.", {
            isError: true,
          })
        }
      } catch {
        window.shopify?.toast.show("Could not switch plans. Try again.", { isError: true })
      } finally {
        setBillingBusy(false)
      }
    },
    [shop, billingEndpoint, billingBusy, openConfirmationUrl],
  )

  const handleCancel = useCallback(async () => {
    if (!shop || !billingEndpoint || billingBusy) return
    const confirmed = window.confirm(
      "Cancel your OriginPass paid plan? You will return to Free after Shopify confirms the cancellation.",
    )
    if (!confirmed) return
    setBillingBusy(true)
    try {
      const token = await getSessionToken()
      const res = await fetch(billingEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "cancel" }),
      })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (!res.ok || !data?.ok) {
        window.shopify?.toast.show(data?.message ?? "Could not cancel the plan. Try again.", { isError: true })
        return
      }
      window.shopify?.toast.show(
        data.message ?? "Cancellation requested; Free after Shopify confirms.",
      )
      if (cancelPollRef.current != null) window.clearInterval(cancelPollRef.current)
      let attempts = 0
      cancelPollRef.current = window.setInterval(() => {
        attempts += 1
        void refreshSubscriptionTier().then((tier) => {
          if (tier === "free" || attempts >= 12) {
            if (cancelPollRef.current != null) {
              window.clearInterval(cancelPollRef.current)
              cancelPollRef.current = null
            }
          }
        })
      }, 2500)
    } catch {
      window.shopify?.toast.show("Could not cancel the plan. Try again.", { isError: true })
    } finally {
      setBillingBusy(false)
    }
  }, [shop, billingEndpoint, billingBusy, refreshSubscriptionTier])

  // Shared "go set up brand defaults" navigation (onboarding guide + empty state).
  const scrollToBrandDefaults = useCallback(() => {
    document.getElementById("brand-defaults-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
    document.getElementById("productionLocation")?.focus({ preventScroll: true })
  }, [])

  async function handleSyncProducts() {
    if (!shop || syncing || syncInFlightRef.current) return
    syncInFlightRef.current = true
    setSyncing(true)
    setSyncPercent(0)
    setSyncStatusMessage("Preparing data…")
    setSyncMessage(null)

    const sessionToken = await getSessionToken()

    // Live progress while the trigger call is in flight — for Branch A (inline)
    // the whole sync happens inside this await, so poll concurrently.
    // Session tokens expire (~60s) — long syncs must fetch a fresh one per poll
    // (App Bridge caches and auto-refreshes idToken, so this is cheap).
    const pollProgressOnce = async () => {
      const token = await getSessionToken()
      return getShopifySyncProgress(shop, token)
    }

    const inFlightPoll = window.setInterval(() => {
      void pollProgressOnce().then((progress) => {
        if (progress.status === "running") {
          setSyncPercent(progress.percent)
          if (progress.message) setSyncStatusMessage(progress.message)
        }
      })
    }, 750)

    try {
      // Hybrid trigger: inline runs return the finished outcome; background runs
      // return immediately with mode: "background" (202-style) for polling.
      const started = await syncStoreProducts(shop, sessionToken)
      window.clearInterval(inFlightPoll)

      if (started.mode !== "background") {
        // Branch A — completed (or failed/capped) within the request.
        setSyncPercent(started.ok ? 100 : 0)
        setSyncStatusMessage(started.message)
        setSyncMessage({ ok: started.ok, text: started.message })
        if (started.ok || started.capped) {
          setLastSyncedAt(new Date().toISOString())
          setFreshUnlocked(true)
          await loadProducts() // capped runs still committed partial data
        }
        return
      }

      // Branch B — transition to the lightweight polling interval against the
      // persistent (Redis-backed) sync status feed until terminal.
      const POLL_MS = 750
      const MAX_POLL_MS = 30 * 60 * 1000 // generous ceiling for 20k+ catalogs
      const startedAt = Date.now()
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
        const progress = await pollProgressOnce()

        if (progress.status === "running") {
          setSyncPercent(progress.percent)
          if (progress.message) setSyncStatusMessage(progress.message)
        } else if (progress.status === "done" || progress.status === "error") {
          setSyncPercent(progress.percent)
          setSyncStatusMessage(progress.message)
          setSyncMessage({
            ok: progress.status === "done",
            text: progress.message ?? (progress.status === "done" ? "Catalog sync complete." : "Sync failed."),
          })
          if (progress.status === "done") {
            setLastSyncedAt(new Date().toISOString())
            setFreshUnlocked(true)
            await loadProducts()
          }
          return
        }
        // "idle" right after enqueue = worker hasn't picked it up yet; keep waiting.

        if (Date.now() - startedAt > MAX_POLL_MS) {
          setSyncMessage({
            ok: false,
            text: "The sync is taking unusually long. It may still finish in the background — refresh in a bit.",
          })
          return
        }
      }
    } finally {
      window.clearInterval(inFlightPoll)
      syncInFlightRef.current = false
      setSyncing(false)
      // Demo storyboard: always reveal the real catalog after a Sync attempt so
      // recording can continue even when App Bridge session tokens are unavailable.
      if (storyboardFresh) {
        setFreshUnlocked(true)
        void loadProducts()
      }
    }
  }

  const syncButtonLabel = syncing
    ? syncPercent > 0
      ? `Syncing… ${syncPercent}%`
      : "Syncing…"
    : "Sync Store Products"

  const syncProgressBar = syncing ? (
    <div className="w-full space-y-2" role="status" aria-live="polite" aria-busy="true">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e3e3e3]">
        <div
          className="h-full rounded-full bg-[#303030] transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(syncPercent, 4)}%` }}
        />
      </div>
      <p className="text-xs text-[#6d7175]">{syncStatusMessage ?? syncButtonLabel}</p>
    </div>
  ) : null

  const awaitingOAuth = Boolean(shop) && (!connectionLoaded || !connected)

  return (
    <>
      <ShopifyAppTitleBar />
      {/* Local-dev aid only — NODE_ENV is inlined at build time, so this whole
          branch is dead-code-eliminated from the production bundle. */}
      {process.env.NODE_ENV !== "production" && !host && shop ? (
        <div id="dev-embed-note" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
          Open this app from the Shopify admin (Apps → OriginPass), not by visiting the tunnel URL directly.
          If the admin iframe is blank, restart <code className="rounded bg-amber-100 px-1">npm run shopify:dev</code>{" "}
          and hard-refresh the admin tab.
        </div>
      ) : null}
      <div className={`min-h-screen bg-[#f6f6f7] px-5 py-8 font-sans text-[#202223] print:hidden ${nativeSaveBarActive ? "pb-8" : "pb-28"}`}>
        <div className="mx-auto w-full max-w-2xl space-y-5">
        {awaitingOAuth ? (
          <section
            aria-labelledby="oauth-connecting-heading"
            className="rounded-xl border border-slate-200 bg-white p-8 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#303030]" aria-hidden />
              <h1 id="oauth-connecting-heading" className="text-lg font-semibold text-slate-900">
                Connecting to Shopify…
              </h1>
              <p className="max-w-sm text-sm leading-relaxed text-slate-600">
                Opening authorization so OriginPass can access your catalog. This page is not interactive until
                the store is linked.
              </p>
            </div>
          </section>
        ) : (
          <>
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Store configuration</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Hook active
              {shop ? (
                <span className="font-normal text-emerald-600/90">· {shop.replace(/\.myshopify\.com$/, "")}</span>
              ) : null}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              Catalog linked
            </span>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-slate-600">
            Set brand-wide defaults and evidence, then sync products and print QR labels. Products inherit these
            defaults until you override them per product.
          </p>
        </header>

        <PlanManagementCard
          tier={subscriptionTier}
          busy={billingBusy || upgrading}
          onCancel={() => void handleCancel()}
          onSwitch={(plan) => void handleSwitch(plan)}
          onUpgrade={(plan) => void handleUpgrade(plan)}
        />

        {initialDataLoaded && uiProducts.length === 0 && !showMerchantEmptyState ? (
          <section
            aria-labelledby="setup-sync-heading"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 2 · Sync</p>
                <h2 id="setup-sync-heading" className="text-base font-semibold text-slate-900">
                  Import products for label printing
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-slate-600">
                  Your store is linked. Pull your catalog into OriginPass to generate print-ready QR label sheets.
                </p>
              </div>
              <button
                type="button"
                onClick={handleProceedToSync}
                className="inline-flex shrink-0 items-center justify-center self-start rounded-lg bg-[#303030] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition hover:bg-[#1a1a1a] active:scale-[0.99]"
              >
                Proceed to sync
              </button>
            </div>
          </section>
        ) : null}

        {/* First-run setup checklist — auto-hides once the catalog has products. */}
        {initialDataLoaded && uiProducts.length === 0 ? (
          <OnboardingGuide
            brandDefaultsSet={Boolean(savedLocation.trim() || savedInstructions.trim())}
            syncing={syncing}
            syncPercent={syncPercent}
            syncDisabled={!shop}
            onSync={() => void handleSyncProducts()}
            onConfigure={scrollToBrandDefaults}
          />
        ) : null}

        {/* Brand defaults */}
        <div id="brand-defaults-section" className={`${cardClass} scroll-mt-4 space-y-5`}>
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-sm font-semibold leading-snug text-[#202223]">Brand defaults</h2>
            {uiProducts.length > 0 ? (
              <p className="text-xs leading-relaxed text-[#6d7175]">
                Currently powering {brandCoverage.productionInherited} of {brandCoverage.total} passports
                (origin) · {brandCoverage.careInherited} of {brandCoverage.total} (care)
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-[#6d7175]">
              Values and evidence inherited by products until a product overrides them individually.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="productionLocation" className="text-sm font-medium text-[#202223]">
              Brand production location
            </label>
            <input
              id="productionLocation"
              name="productionLocation"
              type="text"
              value={location}
              maxLength={PRODUCTION_MAX}
              onChange={(e) => setLocation(e.target.value.slice(0, PRODUCTION_MAX))}
              placeholder="e.g. Florence, Italy"
              className={fieldClass}
            />
            <p className="text-xs text-[#6d7175]">
              {location.length}/{PRODUCTION_MAX} · Inherited by products that have not set their own origin.
            </p>
            {subscriptionTier === "free" ? (
              <EvidenceUpgradeBanner upgrading={upgrading} onUpgrade={() => void handleUpgrade("grower")} />
            ) : (
              <CertificateField shop={shop} field="location" brandDefaultContext onCertChange={() => void loadProducts()} />
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="careInstructions" className="text-sm font-medium text-[#202223]">
              Brand care instructions
            </label>
            <textarea
              id="careInstructions"
              name="careInstructions"
              rows={4}
              value={instructions}
              maxLength={CARE_MAX}
              onChange={(e) => setInstructions(e.target.value.slice(0, CARE_MAX))}
              placeholder="e.g. Hand wash cold · dry flat · do not bleach"
              className={`${fieldClass} resize-none`}
            />
            <p className="text-xs text-[#6d7175]">
              {instructions.length}/{CARE_MAX} · Inherited by products that have not set their own care guidance.
            </p>
            {subscriptionTier === "free" ? (
              <EvidenceUpgradeBanner upgrading={upgrading} onUpgrade={() => void handleUpgrade("grower")} />
            ) : (
              <CertificateField shop={shop} field="care" brandDefaultContext onCertChange={() => void loadProducts()} />
            )}
          </div>

          {saveState.message && !saveState.ok ? (
            <p className="rounded-lg border border-[#fdd0cb] bg-[#fff0ed] px-3.5 py-2.5 text-sm text-[#8e1b16]">
              {saveState.message}
            </p>
          ) : null}
        </div>

        <div id="catalog-sync-section" className={`${cardClass} space-y-4`}>
          <div className="min-w-0 space-y-2">
            <h2 className="text-sm font-semibold text-[#202223]">Print-ready label sheets</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {!showMerchantEmptyState ? (
                <p className="text-xs leading-relaxed text-[#6d7175]">
                  {labelFormat === "avery5160"
                    ? "Avery 5160 · 30 QR labels per page"
                    : "Thermal roll · 2×2 in · 1 label per print slice"}
                  {" · "}
                  Lineage chips show how each product inherits or overrides brand defaults.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-[#6d7175]">
                  Import your catalog to unlock passport generation and Avery label printing.
                </p>
              )}
              {!showMerchantEmptyState ? (
                <div
                  className="inline-flex shrink-0 rounded-lg border border-[#e3e3e3] bg-[#f6f6f7] p-0.5"
                  role="group"
                  aria-label="Print preview format"
                >
                  {LABEL_FORMAT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLabelFormat(option.value)}
                      aria-pressed={labelFormat === option.value}
                      className={[
                        "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                        focusRingClass,
                        labelFormat === option.value
                          ? "bg-white text-[#202223] shadow-[0_1px_0_rgba(0,0,0,0.05)] ring-1 ring-[#e3e3e3]"
                          : "text-[#6d7175] hover:text-[#202223]",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {syncMessage ? (
            <p
              className={`rounded-lg px-3.5 py-2.5 text-sm ${
                syncMessage.ok
                  ? "border border-[#b4fed2] bg-[#ecfdf3] text-[#0d542b]"
                  : "border border-[#fed3d1] bg-[#fff4f4] text-[#8a1f11]"
              }`}
            >
              {syncMessage.text}
            </p>
          ) : null}

          {syncProgressBar}

          {!initialDataLoaded ? (
            <CatalogLoadingSkeleton />
          ) : showMerchantEmptyState ? (
            <MerchantCatalogEmptyState
              syncing={syncing}
              syncPercent={syncPercent}
              disabled={!shop || syncing}
              onSync={() => void handleSyncProducts()}
              onConfigure={scrollToBrandDefaults}
            />
          ) : uiProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#c9cccf] bg-[#fafbfb] px-6 py-10 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f1f2f3] text-[#6d7175]">
                <Package className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="text-sm font-medium tracking-tight text-[#202223]">No products synced yet</p>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[#6d7175]">
                Import your Shopify catalog to generate print-ready QR label sheets for each variant.
              </p>
              <button
                type="button"
                onClick={() => void handleSyncProducts()}
                disabled={syncing || !shop}
                aria-busy={syncing}
                className={`mt-5 inline-flex items-center gap-2 rounded-lg bg-[#303030] px-4 py-2.5 text-sm font-medium text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                {syncButtonLabel}
              </button>
            </div>
          ) : (
            <>
              {uiProducts.length > 0 ? (
                <div
                  id="compliance-health-section"
                  className={`rounded-lg border px-4 py-3 ${
                    missingBrandEvidence || complianceHealth.awaitingEvidence + complianceHealth.needAttention > 0
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-[#e3e3e3] bg-[#fafbfb]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-sm font-semibold text-[#202223]">
                        Compliance health · {complianceHealth.auditReady} of {complianceHealth.total} passports
                        audit-ready
                        {complianceHealth.needAttention > 0
                          ? ` · ${complianceHealth.needAttention} need attention`
                          : ""}
                        {complianceHealth.awaitingEvidence > 0
                          ? ` · ${complianceHealth.awaitingEvidence} awaiting evidence`
                          : ""}
                      </p>
                      {missingBrandEvidence ? (
                        <p className="text-xs leading-relaxed text-amber-950/90">
                          Brand defaults have text but no verifying documents yet. Upload evidence under Brand
                          defaults above (Grower), or use Review to open each product and attach proof one by one.
                        </p>
                      ) : (
                        <p className="text-xs leading-relaxed text-[#6d7175]">
                          Audit-ready means every field inherits verified brand evidence or has its own product
                          proof. Review filters the catalog to incomplete passports so you can Edit and attach
                          documents.
                        </p>
                      )}
                      {conflictFilter ? (
                        <p className="text-xs font-medium text-amber-950">
                          Filter on — catalog below shows only passports that still need evidence or have
                          unverified overrides. Open Edit on a row, attach a document, then return here.
                        </p>
                      ) : null}
                    </div>
                    {complianceHealth.needAttention + complianceHealth.awaitingEvidence > 0 ? (
                      <button
                        type="button"
                        aria-pressed={conflictFilter}
                        onClick={() => {
                          setConflictFilter((prev) => {
                            const next = !prev
                            if (!prev) {
                              // Entering Review — jump to the filtered catalog.
                              window.requestAnimationFrame(() => {
                                document.getElementById("catalog-section")?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                              })
                            }
                            return next
                          })
                        }}
                        className={`inline-flex shrink-0 items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${focusRingClass} ${
                          conflictFilter
                            ? "border-[#c9cccf] bg-white text-[#202223] hover:bg-[#f6f6f7]"
                            : "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                        }`}
                      >
                        {conflictFilter
                          ? "Show all products"
                          : `Review incomplete (${complianceHealth.needAttention + complianceHealth.awaitingEvidence})`}
                      </button>
                    ) : (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                        All audit-ready
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Catalog shell — single padded flex control row (Select all ·
                  search · Qty stepper · Apply) on the same px-3 inset as the
                  product rows below, so all borders share one gridline. */}
              <div
                id="catalog-section"
                className={`scroll-mt-4 overflow-hidden rounded-lg border bg-white ${
                  conflictFilter ? "border-amber-300 ring-1 ring-amber-200" : "border-[#e3e3e3]"
                }`}
              >
                {conflictFilter ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="text-xs font-medium text-amber-950">
                      Showing {visibleProducts.length.toLocaleString()} incomplete passport
                      {visibleProducts.length === 1 ? "" : "s"} — click Edit to attach evidence
                    </p>
                    <button
                      type="button"
                      onClick={() => setConflictFilter(false)}
                      className={`text-xs font-semibold text-amber-950 underline-offset-2 hover:underline ${focusRingClass}`}
                    >
                      Clear filter
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#ebebeb] px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        allSelected
                          ? new Set()
                          : new Set([...prev, ...visibleProducts.map((p) => p.id)]),
                      )
                    }
                    className={`shrink-0 rounded text-xs font-medium text-[#6d7175] transition-colors hover:text-[#202223] ${focusRingClass}`}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                  <input
                    type="search"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search products by name or SKU…"
                    aria-label="Search products"
                    className="min-w-[200px] flex-1 rounded-lg border border-[#c9cccf] bg-white px-3 py-1.5 text-sm text-[#202223] placeholder:text-[#8c9196] outline-none transition-shadow focus:border-black focus:ring-1 focus:ring-black"
                  />
                  <div className="flex shrink-0 items-center gap-1.5">
                    <label htmlFor="qty-all" className="text-xs font-medium text-[#6d7175]">
                      Qty for all
                    </label>
                    <input
                      id="qty-all"
                      type="number"
                      min={1}
                      max={999}
                      value={qtyAll}
                      onChange={(e) => setQtyAll(e.target.value)}
                      className="w-16 rounded-md border border-[#c9cccf] bg-white px-2 py-1.5 text-center text-sm text-[#202223] outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={applyQuantityToAll}
                      className={`rounded-lg border border-[#c9cccf] bg-white px-2.5 py-1.5 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7] ${focusRingClass}`}
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {conflictFilter && visibleProducts.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-[#6d7175]">
                    No incomplete passports right now — every product is audit-ready.
                  </p>
                ) : null}

                {debouncedSearch && visibleProducts.length === 0 && !conflictFilter ? (
                  <p className="px-3 py-3 text-sm text-[#6d7175]">
                    No products match “{debouncedSearch}”.
                  </p>
                ) : null}

                <ul className="max-h-80 overflow-y-auto">
                  {visibleProducts.map((product, index) => (
                    <CatalogProductRow
                      key={product.id}
                      product={product}
                      isLast={index === visibleProducts.length - 1}
                      isSelected={selected.has(product.id)}
                      quantity={quantities[product.id] ?? 1}
                      editorHref={productEditorHref(product.id)}
                      passportHref={product.url}
                      onToggle={toggle}
                      onQuantityChange={setProductQuantity}
                    />
                  ))}
                </ul>
              </div>

              {/* Pagination footer: honest count + Load more for large catalogs. */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#6d7175]">
                  {conflictFilter
                    ? `Showing ${visibleProducts.length.toLocaleString()} incomplete of ${uiCatalogTotal.toLocaleString()} product${uiCatalogTotal === 1 ? "" : "s"}`
                    : `Showing ${uiProducts.length.toLocaleString()} of ${uiCatalogTotal.toLocaleString()} product${uiCatalogTotal === 1 ? "" : "s"}`}
                  {selected.size > 0 ? ` · ${selected.size.toLocaleString()} selected` : ""}
                </p>
                {uiProducts.length < uiCatalogTotal ? (
                  <button
                    type="button"
                    onClick={() => void loadProducts(uiProducts.length)}
                    disabled={loadingMore}
                    className={`inline-flex items-center gap-1.5 rounded-lg border border-[#c9cccf] bg-white px-3 py-1.5 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7] disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
                  >
                    {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    Load more
                  </button>
                ) : null}
              </div>
            </>
          )}

          {uiProducts.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSyncProducts()}
                disabled={syncing || !shop}
                aria-busy={syncing}
                className={`inline-flex items-center gap-2 rounded-lg border border-[#c9cccf] bg-white px-4 py-2.5 text-sm font-medium text-[#202223] transition-all duration-200 hover:bg-[#f6f6f7] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                {syncButtonLabel}
              </button>
              <button
                type="button"
                onClick={() => setShowSheet(true)}
                disabled={!canExportLabels}
                title={canExportLabels ? undefined : "Select at least one product to print labels."}
                className={`inline-flex items-center justify-center rounded-lg bg-[#303030] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#e3e3e3] disabled:text-[#8c9196] disabled:shadow-none ${focusRingClass}`}
              >
                Print label sheets
                {canExportLabels ? ` (${selectedProducts.length})` : ""}
              </button>
              {lastSyncedAt && !syncing ? (
                <p className="text-xs text-[#6d7175]">Last synced {relativeTimeFromNow(lastSyncedAt)}</p>
              ) : null}
            </div>
          ) : null}

          {/* Polaris bodySm / subdued equivalent — always under the sync control. */}
          <p className="text-xs leading-relaxed text-[#6d7175]">
            💡 Note: If your store contains more than 2,000 products, OriginPass shifts to a background worker via
            Shopify&apos;s Bulk API. This process takes 2–3 minutes; you can safely navigate away.
          </p>
        </div>

        <ComplianceFAQ />
          </>
        )}
      </div>
      </div>

      {!awaitingOAuth && !nativeSaveBarActive ? (
      <div
        role="region"
        aria-label="Compliance configuration actions"
        className="fixed inset-x-0 bottom-0 z-[150] border-t border-[#e3e3e3] bg-white/95 px-5 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm print:hidden"
      >
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          {isDirty ? (
            <p className="flex items-center gap-2 text-sm font-medium text-[#202223]">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Unsaved changes
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-[#6d7175]">
              <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} aria-hidden />
              All changes saved
            </p>
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            {isDirty ? (
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="inline-flex min-w-[5.5rem] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-[#5c5f62] transition hover:bg-[#f1f2f3] hover:text-[#202223] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9cccf] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!isDirty || saving}
              aria-busy={saving}
              className="inline-flex min-w-[6rem] items-center justify-center gap-2 rounded-lg bg-[#303030] px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#e3e3e3] disabled:text-[#8c9196] disabled:shadow-none"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </div>
      ) : null}

      {showSheet ? (
        <PrintLabelSheet products={sheetProducts} initialFormat={labelFormat} onClose={() => setShowSheet(false)} />
      ) : null}
    </>
  )
}
