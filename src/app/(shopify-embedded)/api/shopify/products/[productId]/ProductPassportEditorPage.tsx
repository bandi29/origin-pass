"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Loader2, Package } from "lucide-react"
import { CertificateField, type CertificateFieldHandle } from "../../app-home/CertificateField"
import {
  getProductPassportEditor,
  updateProductPassportFields,
  type ProductPassportEditorData,
} from "../../app-home/actions"
import { ConflictResolutionPanel } from "@/components/verification/ConflictResolutionPanel"
import { FieldLineageBadge } from "@/components/verification/FieldLineageBadge"
import { resolveFieldLineage } from "@/lib/field-lineage"
import { shopifyEmbeddedHomeHref } from "@/lib/shopify-embedded-url"
import { useShopifyContextualSave } from "@/app/(shopify-embedded)/ShopifyContextualSaveBar"
import { ShopifyAppTitleBar } from "@/app/(shopify-embedded)/ShopifyAppTitleBar"

const PRODUCT_SAVE_BAR_ID = "product-passport-save-bar"

const PRODUCTION_MAX = 120
const CARE_MAX = 500

const cardClass = "rounded-xl border border-[#e3e3e3] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
const fieldClass =
  "w-full rounded-lg border border-[#c9cccf] bg-white px-3.5 py-2.5 text-sm text-[#202223] placeholder:text-[#8c9196] outline-none transition-shadow focus:border-black focus:ring-1 focus:ring-black"

async function getSessionToken(): Promise<string | undefined> {
  if (typeof window === "undefined" || !window.shopify) return undefined
  try {
    return await window.shopify.idToken()
  } catch {
    return undefined
  }
}

function InheritedFieldBlock({
  label,
  brandValue,
  brandCertPresent,
  onOverride,
}: {
  label: string
  brandValue: string
  brandCertPresent: boolean
  onOverride: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-[#e3e3e3] bg-[#fafbfb] px-3.5 py-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8c9196]">Inherited from brand default</p>
        <p className="mt-1 text-sm text-[#202223]">
          {brandValue || `No brand ${label.toLowerCase()} set yet — set it on Store configuration.`}
        </p>
      </div>
      {brandCertPresent ? (
        <p className="text-xs text-emerald-800">Brand-level evidence on file — this product inherits it on its passport.</p>
      ) : (
        <p className="text-xs text-[#6d7175]">No brand-level evidence yet — this field will appear unverified on the passport.</p>
      )}
      <button
        type="button"
        onClick={onOverride}
        className="inline-flex items-center rounded-lg border border-[#c9cccf] bg-white px-3 py-1.5 text-xs font-semibold text-[#202223] transition hover:bg-[#f6f6f7]"
      >
        Override for this product
      </button>
    </div>
  )
}

export default function ProductPassportEditorPage({ productId }: { productId: string }) {
  const searchParams = useSearchParams()
  const shop = searchParams.get("shop") ?? ""
  const host = searchParams.get("host") ?? ""
  const embedded = searchParams.get("embedded") ?? ""

  const productionCertRef = useRef<CertificateFieldHandle>(null)
  const careCertRef = useRef<CertificateFieldHandle>(null)

  const backHref = useMemo(
    () =>
      shopifyEmbeddedHomeHref({
        embedded: embedded || searchParams.get("embedded"),
        shop,
        host,
      }),
    [embedded, searchParams, shop, host],
  )

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<ProductPassportEditorData | null>(null)
  const [productionLocation, setProductionLocation] = useState("")
  const [careInstructions, setCareInstructions] = useState("")
  const [savedProduction, setSavedProduction] = useState("")
  const [savedCare, setSavedCare] = useState("")
  const [productionEditing, setProductionEditing] = useState(false)
  const [careEditing, setCareEditing] = useState(false)
  const [hasProductCertProduction, setHasProductCertProduction] = useState(false)
  const [hasProductCertCare, setHasProductCertCare] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!shop) return
    setLoading(true)
    const data = await getProductPassportEditor(shop, productId)
    setProduct(data)
    if (data) {
      setProductionLocation(data.productionLocation)
      setCareInstructions(data.careInstructions)
      setSavedProduction(data.productionLocation)
      setSavedCare(data.careInstructions)
      setProductionEditing(Boolean(data.productionLocation.trim()))
      setCareEditing(Boolean(data.careInstructions.trim()))
      setHasProductCertProduction(data.hasProductCertProduction)
      setHasProductCertCare(data.hasProductCertCare)
    }
    setLoading(false)
  }, [shop, productId])

  useEffect(() => {
    void load()
  }, [load])

  const hasUnsavedChanges =
    (productionEditing ? productionLocation : "") !== savedProduction ||
    (careEditing ? careInstructions : "") !== savedCare

  const formFingerprint = [
    productionEditing ? productionLocation : "",
    careEditing ? careInstructions : "",
  ].join("\u001f")

  const handleSave = useCallback(async () => {
    if (!shop || saving) return
    setSaving(true)
    setSaveMessage(null)
    try {
      const sessionToken = await getSessionToken()
      const result = await updateProductPassportFields({
        shop,
        productId,
        sessionToken,
        productionLocation: productionEditing ? productionLocation : "",
        careInstructions: careEditing ? careInstructions : "",
      })
      setSaveMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        setSavedProduction(result.productionLocation)
        setSavedCare(result.careInstructions)
        setProductionLocation(result.productionLocation)
        setCareInstructions(result.careInstructions)
        setProductionEditing(Boolean(result.productionLocation.trim()))
        setCareEditing(Boolean(result.careInstructions.trim()))
        window.shopify?.toast.show("Product passport saved")
        await load()
      } else {
        window.shopify?.toast.show(result.message, { isError: true })
      }
    } finally {
      setSaving(false)
    }
  }, [
    shop,
    saving,
    productId,
    productionEditing,
    productionLocation,
    careEditing,
    careInstructions,
    load,
  ])

  const handleDiscard = useCallback(() => {
    setProductionLocation(savedProduction)
    setCareInstructions(savedCare)
    setProductionEditing(Boolean(savedProduction.trim()))
    setCareEditing(Boolean(savedCare.trim()))
  }, [savedProduction, savedCare])

  const { nativeSaveBarActive, saveBarFormProps, hiddenInputRef } = useShopifyContextualSave({
    id: PRODUCT_SAVE_BAR_ID,
    isDirty: hasUnsavedChanges,
    saving,
    saveLabel: "Save product",
    onSave: handleSave,
    onDiscard: handleDiscard,
    // Native data-save-bar still whitescreens some App Bridge builds — custom footer only.
    useNative: false,
    formFingerprint,
  })

  function revertProductionToBrandDefault() {
    setProductionEditing(false)
    setProductionLocation("")
  }

  function revertCareToBrandDefault() {
    setCareEditing(false)
    setCareInstructions("")
  }

  const productionLineage = product
    ? resolveFieldLineage({
        productValue: productionEditing ? productionLocation : savedProduction,
        brandDefault: product.brandProductionLocation,
        productCertPresent: hasProductCertProduction,
        brandCertPresent: product.brandCertProduction,
      })
    : null

  const careLineage = product
    ? resolveFieldLineage({
        productValue: careEditing ? careInstructions : savedCare,
        brandDefault: product.brandCareInstructions,
        productCertPresent: hasProductCertCare,
        brandCertPresent: product.brandCertCare,
      })
    : null

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f7]">
        <Loader2 className="h-6 w-6 animate-spin text-[#6d7175]" aria-hidden />
      </div>
    )
  }

  if (!product || !productionLineage || !careLineage) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] px-5 py-8 font-sans text-[#202223]">
        <div className="mx-auto max-w-2xl space-y-4">
          <a href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-[#202223] hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to store configuration
          </a>
          <p className="rounded-lg border border-[#fdd0cb] bg-[#fff0ed] px-4 py-3 text-sm text-[#8e1b16]">
            Product not found. Sync your catalog and try again.
          </p>
        </div>
      </div>
    )
  }

  const pageShellClass = `min-h-screen bg-[#f6f6f7] px-5 py-8 font-sans text-[#202223] print:hidden ${nativeSaveBarActive ? "pb-8" : "pb-28"}`

  const pageBody = (
    <>
      <ShopifyAppTitleBar
        title={product.title || "Product passport"}
        breadcrumbHref={backHref}
        breadcrumbLabel="OriginPass"
      />
      {saveBarFormProps ? (
        <input
          ref={hiddenInputRef}
          type="hidden"
          name="originpass-product-state"
          defaultValue=""
          aria-hidden
        />
      ) : null}
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <header className="space-y-3">
          <a href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-[#5c5f62] transition hover:text-[#202223]">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to store configuration
          </a>
          <div className="flex items-start gap-3">
            <div className="relative aspect-square h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#e3e3e3] bg-white">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain p-1" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-5 w-5 text-[#8c9196]" aria-hidden />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{product.title}</h1>
              {product.sku ? <p className="text-sm text-[#6d7175]">{product.sku}</p> : null}
              <p className="mt-1 text-sm text-[#6d7175]">
                Fields inherit brand defaults until you override them. Product-specific evidence is required for
                overridden values.
              </p>
            </div>
          </div>
        </header>

        <div className={`${cardClass} space-y-5`}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="productProductionLocation" className="text-sm font-medium text-[#202223]">
                Production location
              </label>
              <FieldLineageBadge state={productionLineage.state} brandCertPresent={product.brandCertProduction} />
            </div>

            {productionEditing ? (
              <>
                <input
                  id="productProductionLocation"
                  type="text"
                  maxLength={PRODUCTION_MAX}
                  value={productionLocation}
                  onChange={(e) => setProductionLocation(e.target.value.slice(0, PRODUCTION_MAX))}
                  placeholder="e.g. Vietnam"
                  className={fieldClass}
                />
                <p className="text-xs text-[#6d7175]">
                  {productionLocation.length}/{PRODUCTION_MAX}
                  {productionLineage.valueDiffersFromBrand ? " · Product-specific value" : " · Matches brand default"}
                </p>
                {productionLineage.isUnverifiedClaim ? (
                  <ConflictResolutionPanel
                    fieldLabel="production location"
                    onAttach={() => productionCertRef.current?.openFilePicker()}
                    onRevert={revertProductionToBrandDefault}
                  />
                ) : null}
                <CertificateField
                  ref={productionCertRef}
                  shop={shop}
                  field="location"
                  productId={productId}
                  dataProvenance={productionLineage.valueDiffersFromBrand ? "record" : "fallback"}
                  conflictMode={productionLineage.isUnverifiedClaim}
                  onCertChange={() => void load()}
                />
              </>
            ) : (
              <>
                <InheritedFieldBlock
                  label="production location"
                  brandValue={product.brandProductionLocation}
                  brandCertPresent={product.brandCertProduction}
                  onOverride={() => {
                    setProductionEditing(true)
                    setProductionLocation(savedProduction || product.brandProductionLocation)
                  }}
                />
                <CertificateField
                  shop={shop}
                  field="location"
                  productId={productId}
                  inheritanceMode
                  onCertChange={() => void load()}
                />
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="productCareInstructions" className="text-sm font-medium text-[#202223]">
                Care instructions
              </label>
              <FieldLineageBadge state={careLineage.state} brandCertPresent={product.brandCertCare} />
            </div>

            {careEditing ? (
              <>
                <textarea
                  id="productCareInstructions"
                  rows={4}
                  maxLength={CARE_MAX}
                  value={careInstructions}
                  onChange={(e) => setCareInstructions(e.target.value.slice(0, CARE_MAX))}
                  placeholder="Product-specific care guidance"
                  className={`${fieldClass} resize-none`}
                />
                <p className="text-xs text-[#6d7175]">
                  {careInstructions.length}/{CARE_MAX}
                  {careLineage.valueDiffersFromBrand ? " · Product-specific value" : " · Matches brand default"}
                </p>
                {careLineage.isUnverifiedClaim ? (
                  <ConflictResolutionPanel
                    fieldLabel="care instructions"
                    onAttach={() => careCertRef.current?.openFilePicker()}
                    onRevert={revertCareToBrandDefault}
                  />
                ) : null}
                <CertificateField
                  ref={careCertRef}
                  shop={shop}
                  field="care"
                  productId={productId}
                  dataProvenance={careLineage.valueDiffersFromBrand ? "record" : "fallback"}
                  conflictMode={careLineage.isUnverifiedClaim}
                  onCertChange={() => void load()}
                />
              </>
            ) : (
              <>
                <InheritedFieldBlock
                  label="care instructions"
                  brandValue={product.brandCareInstructions}
                  brandCertPresent={product.brandCertCare}
                  onOverride={() => {
                    setCareEditing(true)
                    setCareInstructions(savedCare || product.brandCareInstructions)
                  }}
                />
                <CertificateField
                  shop={shop}
                  field="care"
                  productId={productId}
                  inheritanceMode
                  onCertChange={() => void load()}
                />
              </>
            )}
          </div>

          {saveMessage && !saveMessage.ok ? (
            <p className="rounded-lg border border-[#fdd0cb] bg-[#fff0ed] px-3.5 py-2.5 text-sm text-[#8e1b16]">
              {saveMessage.text}
            </p>
          ) : null}
        </div>
      </div>

      {!nativeSaveBarActive ? (
        <div className="fixed inset-x-0 bottom-0 z-[150] border-t border-[#e3e3e3] bg-white/95 px-5 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm print:hidden">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
            {hasUnsavedChanges ? (
              <p className="text-sm font-medium text-[#202223]">Unsaved product changes</p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-[#6d7175]">
                <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} aria-hidden />
                Saved
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={!hasUnsavedChanges || saving}
                className="rounded-lg border border-[#c9cccf] bg-white px-4 py-2 text-sm font-medium text-[#202223] disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasUnsavedChanges || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#303030] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Save product
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  if (saveBarFormProps) {
    return (
      <form {...saveBarFormProps} className={pageShellClass}>
        {pageBody}
      </form>
    )
  }

  return <div className={pageShellClass}>{pageBody}</div>
}
