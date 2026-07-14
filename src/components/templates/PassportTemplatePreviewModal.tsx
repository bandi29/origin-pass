"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/Modal"
import { ClassicTheme } from "@/components/templates/ClassicTheme"
import { LuxuryTheme } from "@/components/templates/LuxuryTheme"
import { PASSPORT_TEMPLATE_PREVIEW_MOCK } from "@/components/templates/passport-template-mock"
import type { PassportTemplateKey } from "@/lib/passport-display-templates"

type PreviewMockVariant = "leather" | "cotton"

const COTTON_MOCK = {
  ...PASSPORT_TEMPLATE_PREVIEW_MOCK,
  productData: PASSPORT_TEMPLATE_PREVIEW_MOCK.productData
    ? {
        ...PASSPORT_TEMPLATE_PREVIEW_MOCK.productData,
        name: "Organic Cotton Field Jacket",
        description:
          "Heavyweight organic cotton canvas with corozo buttons. Garment-dyed in small batches for a lived-in finish.",
        category: "Apparel",
        origin: "Portugal",
      }
    : null,
  batchData: {
    production_run_name: "Coastal Studio Drop",
    artisan_name: "Maria Silva",
    location: "Porto",
    produced_at: "2026-04-12",
  },
  storyText:
    "Woven in a GOTS-certified mill and sewn in a solar-powered workshop. Designed for years of wear, not seasons.",
}

export function PassportTemplatePreviewModal({
  open,
  onClose,
  templateKey,
}: {
  open: boolean
  onClose: () => void
  templateKey: PassportTemplateKey
}) {
  const [variant, setVariant] = useState<PreviewMockVariant>("leather")
  const Theme = templateKey === "luxury" ? LuxuryTheme : ClassicTheme
  const mock = variant === "cotton" ? COTTON_MOCK : PASSPORT_TEMPLATE_PREVIEW_MOCK

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Template preview"
      description="Approximate layout customers see after scanning your QR code."
      size="lg"
      className="max-w-5xl border-slate-200 bg-white"
    >
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setVariant("leather")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            variant === "leather"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Leather bag mock
        </button>
        <button
          type="button"
          onClick={() => setVariant("cotton")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            variant === "cotton"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Cotton jacket mock
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Mobile
          </p>
          <div className="mx-auto w-[min(100%,280px)] rounded-[2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
            <div className="max-h-[520px] overflow-y-auto rounded-[1.35rem] bg-black">
              <Theme embed sharePreview {...mock} />
            </div>
          </div>
        </div>
        <div>
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Desktop
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner">
            <div className="max-h-[480px] overflow-y-auto">
              <div className="origin-top scale-[0.68]">
                <Theme embed sharePreview {...mock} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
