"use client"

import { useState } from "react"
import { Link } from "@/i18n/navigation"
import { ChevronRight, Loader2 } from "lucide-react"
import { createPassportAction } from "@/actions/create-passport"
import { ProductPickerCombobox } from "@/components/dashboard/ProductPickerCombobox"
import { ProductRequiredForPassportModal } from "@/components/passports/ProductRequiredForPassportModal"

type Step = 1 | 2 | 3 | 4

const STEPS: { num: Step; title: string }[] = [
  { num: 1, title: "Select Product" },
  { num: 2, title: "Serial Generation" },
  { num: 3, title: "Generate" },
  { num: 4, title: "QR Identity" },
]

const btnPrimary =
  "inline-flex cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"

const btnSecondary =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"

const linkPrimary =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"

const linkSecondary =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

type CreatePassportFormProps = {
  products: { id: string; name: string; incomplete?: boolean }[]
  /** Defaults to product-area create flow. */
  createAnotherHref?: string
}

export function CreatePassportForm({ products, createAnotherHref = "/dashboard/product-identity/passports/create" }: CreatePassportFormProps) {
  const [step, setStep] = useState<Step>(1)
  const [productId, setProductId] = useState("")
  const [serialFormat, setSerialFormat] = useState("OP-{SEQ}")
  const [batchSize, setBatchSize] = useState(1)
  const [manufacturingDate, setManufacturingDate] = useState("")
  const [originCountry, setOriginCountry] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPassport, setCreatedPassport] = useState<{
    id: string
    passportUid: string
    serialNumber: string
  } | null>(null)

  const handleStep1Next = () => {
    if (!productId) return
    const picked = products.find((p) => p.id === productId)
    if (picked?.incomplete) {
      setError("This product is missing Origin or a product image. Complete it before issuing a passport.")
      return
    }
    setError(null)
    setStep(2)
  }

  const handleStep2Next = () => {
    setStep(3)
  }

  const handleStep3Submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await createPassportAction({
        productId,
        serialFormat,
        batchSize,
        manufacturingDate: manufacturingDate || undefined,
        originCountry: originCountry || undefined,
      })
      if (!result.success) {
        const msg = result.error ?? "Failed to create passport"
        setError(
          /Upgrade to Pro|passport limit|Starter Free/i.test(msg)
            ? `${msg} Open Billing in your Shopify app to upgrade.`
            : msg,
        )
        return
      }
      if (result.passport) {
        setCreatedPassport(result.passport)
        setStep(4)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create passport")
    } finally {
      setLoading(false)
    }
  }

  const selectedProduct = products.find((p) => p.id === productId)

  if (products.length === 0) {
    return <ProductRequiredForPassportModal />
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-8 flex gap-2">
        {STEPS.map((s) => (
          <div
            key={s.num}
            className={`flex items-center gap-1 text-sm ${
              step >= s.num ? "text-slate-900 font-medium" : "text-slate-400"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                step > s.num
                  ? "bg-emerald-100 text-emerald-700"
                  : step === s.num
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100"
              }`}
            >
              {step > s.num ? "✓" : s.num}
            </span>
            <span>{s.title}</span>
            {s.num < 4 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="max-w-md space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Product</label>
            <ProductPickerCombobox
              items={products.map((p) => ({
                productId: p.id,
                productName: p.name,
                incomplete: p.incomplete,
              }))}
              value={productId || null}
              onChange={(id) => setProductId(id ?? "")}
              allowAll={false}
              placeholder="Select a product"
              disabled={loading}
              className="w-full max-w-md"
            />
            <p className="text-xs text-slate-500">
              Products tagged{" "}
              <span className="font-semibold text-amber-700">Incomplete</span> are missing Origin or a
              product image and can&apos;t be issued until fixed.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleStep1Next}
              disabled={!productId}
              className={btnPrimary}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Serial format
            </label>
            <input
              type="text"
              value={serialFormat}
              onChange={(e) => setSerialFormat(e.target.value)}
              placeholder="OP-{SEQ} or BRAND-{YYYY}-{SEQ}"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
            <p className="mt-1 text-xs text-slate-500">
              Use {"{SEQ}"} for sequence number, {"{YYYY}"} for year
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Batch size
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 1)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Manufacturing date (optional)
            </label>
            <input
              type="date"
              value={manufacturingDate}
              onChange={(e) => setManufacturingDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Origin country (optional)
            </label>
            <input
              type="text"
              value={originCountry}
              onChange={(e) => setOriginCountry(e.target.value)}
              placeholder="e.g. IT, FR"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={btnSecondary}
            >
              Back
            </button>
            <button type="button" onClick={handleStep2Next} className={btnPrimary}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Summary</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>Product: {selectedProduct?.name ?? "—"}</li>
              <li>Serial format: {serialFormat}</li>
              <li>Quantity: {batchSize}</li>
              {manufacturingDate && (
                <li>Manufacturing date: {manufacturingDate}</li>
              )}
              {originCountry && (
                <li>Origin country: {originCountry}</li>
              )}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className={btnSecondary}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleStep3Submit}
              disabled={loading}
              className={`${btnPrimary} gap-2`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate Passport"
              )}
            </button>
          </div>
        </div>
      )}

      {step === 4 && createdPassport && (
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-medium text-emerald-800">Passport created</p>
            <p className="mt-1 text-sm text-emerald-700">
              Serial: <code>{createdPassport.serialNumber}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/dashboard/product-identity/passports/${createdPassport.id}`} className={linkPrimary}>
              View Passport
            </Link>
            <Link
              href={`/dashboard/product-identity/passports/${createdPassport.id}?tab=qr`}
              className={linkSecondary}
            >
              Download QR
            </Link>
            <Link href={createAnotherHref} className={linkSecondary}>
              Create Another
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
