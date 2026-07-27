"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Loader2, Package } from "lucide-react"
import { CertificateField, type CertificateFieldHandle } from "../../app-home/CertificateField"
import {
  getProductPassportEditor,
  isStoreConnected,
  updateProductPassportFields,
  type ProductPassportEditorData,
} from "../../app-home/actions"
import { gtinFormatLabel, normalizeGtinDigits, validateGTIN } from "@/lib/gs1"
import { calculateComplianceScore } from "@/lib/compliance-score"
import { ComplianceScorecard } from "@/components/admin/ComplianceScorecard"
import { ConflictResolutionPanel } from "@/components/verification/ConflictResolutionPanel"
import { FieldLineageBadge } from "@/components/verification/FieldLineageBadge"
import { resolveFieldLineage } from "@/lib/field-lineage"
import { openOutsideShopifyEmbed, shopifyEmbeddedHomeHref } from "@/lib/shopify-embedded-url"
import { useShopifyContextualSave } from "@/app/(shopify-embedded)/ShopifyContextualSaveBar"
import { ShopifyAppTitleBar } from "@/app/(shopify-embedded)/ShopifyAppTitleBar"

const PRODUCT_SAVE_BAR_ID = "product-passport-save-bar"

const PRODUCTION_MAX = 120
const CARE_MAX = 500
const MATERIALS_MAX = 500

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
  const [authChecking, setAuthChecking] = useState(true)
  const [connected, setConnected] = useState(false)
  const [product, setProduct] = useState<ProductPassportEditorData | null>(null)
  const [productionLocation, setProductionLocation] = useState("")
  const [careInstructions, setCareInstructions] = useState("")
  const [materials, setMaterials] = useState("")
  const [gtin, setGtin] = useState("")
  const [gln, setGln] = useState("")
  const [defaultLotNumber, setDefaultLotNumber] = useState("")
  /** passportId -> GTIN draft for DPP-03 variant mapping */
  const [variantGtins, setVariantGtins] = useState<Record<string, string>>({})
  const [savedProduction, setSavedProduction] = useState("")
  const [savedCare, setSavedCare] = useState("")
  const [savedMaterials, setSavedMaterials] = useState("")
  const [savedGtin, setSavedGtin] = useState("")
  const [savedGln, setSavedGln] = useState("")
  const [savedLot, setSavedLot] = useState("")
  const [savedVariantGtins, setSavedVariantGtins] = useState<Record<string, string>>({})
  const [gtinTouched, setGtinTouched] = useState(false)
  const [variantGtinTouched, setVariantGtinTouched] = useState<Record<string, boolean>>({})
  const [productionEditing, setProductionEditing] = useState(false)
  const [careEditing, setCareEditing] = useState(false)
  const [hasProductCertProduction, setHasProductCertProduction] = useState(false)
  const [hasProductCertCare, setHasProductCertCare] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const connectUrl = useMemo(() => {
    if (!shop) return ""
    const params = new URLSearchParams({ shop })
    if (host) params.set("host", host)
    return `/api/shopify/auth?${params.toString()}`
  }, [shop, host])

  const load = useCallback(async () => {
    if (!shop) return
    setLoading(true)
    const data = await getProductPassportEditor(shop, productId, await getSessionToken())
    setProduct(data)
    if (data) {
      const variantMap: Record<string, string> = {}
      for (const v of data.variants ?? []) variantMap[v.passportId] = v.gtin
      setProductionLocation(data.productionLocation)
      setCareInstructions(data.careInstructions)
      setMaterials(data.materials)
      setGtin(data.gtin)
      setGln(data.gln)
      setDefaultLotNumber(data.defaultLotNumber)
      setVariantGtins(variantMap)
      setSavedProduction(data.productionLocation)
      setSavedCare(data.careInstructions)
      setSavedMaterials(data.materials)
      setSavedGtin(data.gtin)
      setSavedGln(data.gln)
      setSavedLot(data.defaultLotNumber)
      setSavedVariantGtins(variantMap)
      setGtinTouched(false)
      setVariantGtinTouched({})
      setProductionEditing(Boolean(data.productionLocation.trim()))
      setCareEditing(Boolean(data.careInstructions.trim()))
      setHasProductCertProduction(data.hasProductCertProduction)
      setHasProductCertCare(data.hasProductCertCare)
    }
    setLoading(false)
  }, [shop, productId])

  useEffect(() => {
    if (!shop) {
      setAuthChecking(false)
      return
    }
    let active = true
    getSessionToken()
      .then((token) => isStoreConnected(shop, token))
      .then((ok) => {
        if (!active) return
        setConnected(ok)
        if (!ok && connectUrl) {
          openOutsideShopifyEmbed(connectUrl, "top")
        }
      })
      .finally(() => {
        if (active) setAuthChecking(false)
      })
    return () => {
      active = false
    }
  }, [shop, connectUrl])

  useEffect(() => {
    if (!connected) return
    void load()
  }, [connected, load])

  const gtinDigits = normalizeGtinDigits(gtin)
  const gtinValid = !gtinDigits || validateGTIN(gtinDigits)
  const gtinLabel = gtinDigits && validateGTIN(gtinDigits) ? gtinFormatLabel(gtinDigits) : null

  const variantGtinFingerprint = Object.keys({ ...savedVariantGtins, ...variantGtins })
    .sort()
    .map((id) => `${id}:${normalizeGtinDigits(variantGtins[id] ?? "")}`)
    .join("|")
  const savedVariantFingerprint = Object.keys(savedVariantGtins)
    .sort()
    .map((id) => `${id}:${normalizeGtinDigits(savedVariantGtins[id] ?? "")}`)
    .join("|")

  const hasUnsavedChanges =
    (productionEditing ? productionLocation : "") !== savedProduction ||
    (careEditing ? careInstructions : "") !== savedCare ||
    materials.trim() !== savedMaterials.trim() ||
    gtinDigits !== normalizeGtinDigits(savedGtin) ||
    normalizeGtinDigits(gln) !== normalizeGtinDigits(savedGln) ||
    defaultLotNumber.trim() !== savedLot.trim() ||
    variantGtinFingerprint !== savedVariantFingerprint

  const formFingerprint = [
    productionEditing ? productionLocation : "",
    careEditing ? careInstructions : "",
    materials.trim(),
    gtinDigits,
    normalizeGtinDigits(gln),
    defaultLotNumber.trim(),
    variantGtinFingerprint,
  ].join("\u001f")

  const handleSave = useCallback(async () => {
    if (!shop || saving) return
    if (gtinDigits && !validateGTIN(gtinDigits)) {
      setGtinTouched(true)
      setSaveMessage({ ok: false, text: "GTIN check digit is invalid." })
      window.shopify?.toast.show("GTIN check digit is invalid.", { isError: true })
      return
    }
    for (const [passportId, value] of Object.entries(variantGtins)) {
      const digits = normalizeGtinDigits(value)
      if (digits && !validateGTIN(digits)) {
        setVariantGtinTouched((prev) => ({ ...prev, [passportId]: true }))
        setSaveMessage({ ok: false, text: "One or more variant GTINs are invalid." })
        window.shopify?.toast.show("Variant GTIN check digit is invalid.", { isError: true })
        return
      }
    }
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
        materials: materials.trim(),
        gtin: gtinDigits,
        gln: normalizeGtinDigits(gln),
        defaultLotNumber: defaultLotNumber.trim(),
        variantGtins: Object.entries(variantGtins).map(([passportId, value]) => ({
          passportId,
          gtin: normalizeGtinDigits(value),
        })),
      })
      setSaveMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        const variantMap: Record<string, string> = {}
        for (const v of result.variants ?? []) variantMap[v.passportId] = v.gtin
        setSavedProduction(result.productionLocation)
        setSavedCare(result.careInstructions)
        setSavedMaterials(result.materials)
        setProductionLocation(result.productionLocation)
        setCareInstructions(result.careInstructions)
        setMaterials(result.materials)
        setGtin(result.gtin)
        setGln(result.gln)
        setDefaultLotNumber(result.defaultLotNumber)
        setVariantGtins(variantMap)
        setSavedGtin(result.gtin)
        setSavedGln(result.gln)
        setSavedLot(result.defaultLotNumber)
        setSavedVariantGtins(variantMap)
        setGtinTouched(false)
        setVariantGtinTouched({})
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
    materials,
    gtinDigits,
    gln,
    defaultLotNumber,
    variantGtins,
    load,
  ])

  const handleDiscard = useCallback(() => {
    setProductionLocation(savedProduction)
    setCareInstructions(savedCare)
    setMaterials(savedMaterials)
    setGtin(savedGtin)
    setGln(savedGln)
    setDefaultLotNumber(savedLot)
    setVariantGtins(savedVariantGtins)
    setGtinTouched(false)
    setVariantGtinTouched({})
    setProductionEditing(Boolean(savedProduction.trim()))
    setCareEditing(Boolean(savedCare.trim()))
  }, [savedProduction, savedCare, savedMaterials, savedGtin, savedGln, savedLot, savedVariantGtins])

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

  const complianceScore = useMemo(() => {
    if (!product) return null
    const effectiveOrigin =
      (productionEditing ? productionLocation : savedProduction).trim() ||
      product.brandProductionLocation.trim()
    const effectiveCare =
      (careEditing ? careInstructions : savedCare).trim() || product.brandCareInstructions.trim()
    return calculateComplianceScore({
      productGtin: gtin,
      variantGtins: Object.values(variantGtins),
      countryOfOrigin: effectiveOrigin,
      materialComposition: materials,
      careInstructions: effectiveCare,
      hasComplianceDocument:
        hasProductCertProduction ||
        hasProductCertCare ||
        product.brandCertProduction ||
        product.brandCertCare,
    })
  }, [
    product,
    productionEditing,
    productionLocation,
    savedProduction,
    careEditing,
    careInstructions,
    savedCare,
    materials,
    gtin,
    variantGtins,
    hasProductCertProduction,
    hasProductCertCare,
  ])

  if (authChecking || !connected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6f6f7] px-5" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-[#303030]" aria-hidden />
        <p className="text-sm font-medium text-[#202223]">Connecting to Shopify…</p>
      </div>
    )
  }

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

  const pageShellClass = `scroll-smooth min-h-screen bg-[#f6f6f7] px-5 py-8 font-sans text-[#202223] print:hidden ${nativeSaveBarActive ? "pb-8" : "pb-28"}`

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

        {complianceScore ? <ComplianceScorecard result={complianceScore} /> : null}

        <div className={`${cardClass} space-y-5`}>
          <div id="eu-score-origin" className="scroll-mt-6 space-y-3">
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
                <div id="eu-score-docs" className="scroll-mt-6">
                  <CertificateField
                    ref={productionCertRef}
                    shop={shop}
                    field="location"
                    productId={productId}
                    dataProvenance={productionLineage.valueDiffersFromBrand ? "record" : "fallback"}
                    conflictMode={productionLineage.isUnverifiedClaim}
                    onCertChange={() => void load()}
                  />
                </div>
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
                <div id="eu-score-docs" className="scroll-mt-6">
                  <CertificateField
                    shop={shop}
                    field="location"
                    productId={productId}
                    inheritanceMode
                    onCertChange={() => void load()}
                  />
                </div>
              </>
            )}
          </div>

          <div id="eu-score-materials" className="scroll-mt-6 space-y-3">
            <label htmlFor="productMaterials" className="text-sm font-medium text-[#202223]">
              Material composition
            </label>
            <textarea
              id="productMaterials"
              rows={3}
              maxLength={MATERIALS_MAX}
              value={materials}
              onChange={(e) => setMaterials(e.target.value.slice(0, MATERIALS_MAX))}
              placeholder="e.g. 80% Organic Cotton, 20% Recycled Polyester"
              className={`${fieldClass} resize-none`}
            />
            <p className="text-xs text-[#6d7175]">
              {materials.length}/{MATERIALS_MAX} · Required for EU ESPR textile disclosures
            </p>
          </div>

          <div id="eu-score-care" className="scroll-mt-6 space-y-3">
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

          <div id="eu-score-gtin" className="scroll-mt-6 space-y-4 border-t border-[#e3e3e3] pt-5">
            <div>
              <h2 className="text-sm font-semibold text-[#202223]">GS1 Digital Link Identifiers</h2>
              <p className="mt-1 text-xs text-[#6d7175]">
                Optional. When a valid GTIN is set, printed QR codes use a GS1 Digital Link
                (<code className="text-[11px]">/01/&#123;gtin&#125;</code>). Leave blank to keep the standard
                OriginPass link.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="productGtin" className="text-sm font-medium text-[#202223]">
                  Product GTIN / EAN / UPC (fallback)
                </label>
                {gtinLabel ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                    ✓ GS1 Valid {gtinLabel}
                  </span>
                ) : null}
              </div>
              <input
                id="productGtin"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={18}
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                onBlur={() => {
                  setGtinTouched(true)
                  const digits = normalizeGtinDigits(gtin)
                  if (digits) setGtin(digits)
                }}
                placeholder="e.g. 5901234123457"
                className={fieldClass}
              />
              {gtinTouched && gtinDigits && !gtinValid ? (
                <p className="text-xs text-[#8e1b16]">Invalid Modulo-10 check digit for this GTIN.</p>
              ) : (
                <p className="text-xs text-[#6d7175]">
                  Used when a variant has no GTIN. Prefer per-variant GTINs below for size/color SKUs.
                </p>
              )}
            </div>

            {(product.variants?.length ?? 0) > 0 ? (
              <div className="space-y-3 rounded-lg border border-[#e3e3e3] bg-[#fafbfb] px-3.5 py-3">
                <div>
                  <p className="text-sm font-medium text-[#202223]">Variant GTINs</p>
                  <p className="mt-0.5 text-xs text-[#6d7175]">
                    Each Shopify variant can have its own GTIN. Scanning that Digital Link opens the
                    matching variant passport.
                  </p>
                </div>
                <ul className="space-y-3">
                  {product.variants.map((variant) => {
                    const value = variantGtins[variant.passportId] ?? ""
                    const digits = normalizeGtinDigits(value)
                    const valid = !digits || validateGTIN(digits)
                    const label = digits && validateGTIN(digits) ? gtinFormatLabel(digits) : null
                    const touched = Boolean(variantGtinTouched[variant.passportId])
                    return (
                      <li key={variant.passportId} className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={`variantGtin-${variant.passportId}`}
                            className="text-xs font-semibold text-[#202223]"
                          >
                            {variant.label}
                            {variant.serialNumber ? (
                              <span className="ml-1 font-normal text-[#6d7175]">
                                · {variant.serialNumber}
                              </span>
                            ) : null}
                          </label>
                          {label ? (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                              ✓ GS1 Valid {label}
                            </span>
                          ) : null}
                        </div>
                        <input
                          id={`variantGtin-${variant.passportId}`}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={18}
                          value={value}
                          onChange={(e) =>
                            setVariantGtins((prev) => ({
                              ...prev,
                              [variant.passportId]: e.target.value,
                            }))
                          }
                          onBlur={() => {
                            setVariantGtinTouched((prev) => ({ ...prev, [variant.passportId]: true }))
                            const next = normalizeGtinDigits(variantGtins[variant.passportId] ?? "")
                            if (next) {
                              setVariantGtins((prev) => ({ ...prev, [variant.passportId]: next }))
                            }
                          }}
                          placeholder="Variant GTIN (optional)"
                          className={fieldClass}
                        />
                        {touched && digits && !valid ? (
                          <p className="text-xs text-[#8e1b16]">Invalid Modulo-10 check digit.</p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-[#6d7175]">
                Sync your Shopify catalog to edit per-variant GTINs (Size S / M / L, etc.).
              </p>
            )}

            <div className="space-y-2">
              <label htmlFor="productLot" className="text-sm font-medium text-[#202223]">
                Batch / Lot Number (AI 10)
              </label>
              <input
                id="productLot"
                type="text"
                maxLength={80}
                value={defaultLotNumber}
                onChange={(e) => setDefaultLotNumber(e.target.value.slice(0, 80))}
                placeholder="Optional default lot for Digital Link QR"
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="productGln" className="text-sm font-medium text-[#202223]">
                GLN (optional)
              </label>
              <input
                id="productGln"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={13}
                value={gln}
                onChange={(e) => setGln(e.target.value)}
                onBlur={() => {
                  const digits = normalizeGtinDigits(gln).slice(0, 13)
                  setGln(digits)
                }}
                placeholder="13-digit Global Location Number"
                className={fieldClass}
              />
            </div>
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
