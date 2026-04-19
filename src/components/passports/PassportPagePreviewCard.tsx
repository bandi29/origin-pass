import { Braces, CheckCircle2, QrCode, Radio, ShieldCheck } from "lucide-react"
import { twMerge } from "tailwind-merge"
import { marketingIconBoxClass } from "@/components/marketing/marketingLayout"

/** Demo copy for marketing surfaces (homepage, showcase). */
export const MARKETING_PASSPORT_PREVIEW_DEMO = {
  productName: "Heritage Leather Tote",
  subtitle: "Aurum Atelier · Batch AW-26",
  productStory:
    "Hand-finished in Tuscany using vegetable-tanned leather from certified Italian tanneries. Each tote is numbered and traceable to batch and workshop.",
  materials: "Full-grain leather – Italy, Organic cotton lining – Portugal",
  scanHint: "Scan opens passport: story, materials, origin, and ownership — no app install.",
} as const

function formatMaterialLines(materials: string | null | undefined): string[] {
  if (!materials?.trim()) return []
  return materials
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export type PassportPagePreviewCardProps = {
  productName: string
  /** e.g. brand · batch */
  subtitle?: string | null
  productStory?: string | null
  materials?: string | null
  /** JSON-LD + Registry sync chips (marketing hero) */
  showStructuredDataTags?: boolean
  /** Muted box reinforcing QR / no app install */
  scanHint?: string | null
  /** When true, empty story/materials show em dash */
  showEmptyState?: boolean
  className?: string
  /** Hero-style hover lift */
  interactiveHover?: boolean
}

export function PassportPagePreviewCard({
  productName,
  subtitle,
  productStory,
  materials,
  showStructuredDataTags = false,
  scanHint,
  showEmptyState = false,
  className,
  interactiveHover = false,
}: PassportPagePreviewCardProps) {
  const materialLines = formatMaterialLines(materials)
  const storyText = productStory?.trim() ?? ""
  const hasStory = storyText.length > 0
  const hasMaterials = materialLines.length > 0

  return (
    <div
      className={twMerge(
        "hero-card w-full max-w-[440px] rounded-2xl border border-border bg-white/90 p-6 backdrop-blur-sm",
        "shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
        interactiveHover &&
          "group transform transition-all duration-200 ease-smooth hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Verified Authentic
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900">
              <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">OriginPass</span>
          </div>
          {showStructuredDataTags ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                <Braces className="h-3 w-3 text-slate-500" aria-hidden />
                JSON-LD
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800"
                title="Structured data aligned with EU Central Registry expectations"
              >
                <Radio className="h-3 w-3 text-emerald-600" aria-hidden />
                Registry sync
              </span>
            </div>
          ) : null}
          <p className="mt-3 text-lg font-bold text-black">{productName}</p>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
          ) : null}
        </div>
        <div
          className={twMerge(marketingIconBoxClass("green"), "shrink-0")}
          title="Opens in the browser — no app install"
        >
          <QrCode className="h-5 w-5" aria-hidden />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {(hasStory || showEmptyState) && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Product story
            </p>
            <div className="mt-2 rounded-2xl bg-gray-50/90 p-4 text-[15px] leading-[26px] text-gray-600">
              {hasStory ? (
                <p className="whitespace-pre-wrap">{storyText}</p>
              ) : (
                <p className="text-slate-400">—</p>
              )}
            </div>
          </div>
        )}

        {(hasMaterials || showEmptyState) && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Materials</p>
            <div className="mt-2 rounded-2xl bg-gray-50/90 p-4 text-[15px] leading-[26px] text-gray-600">
              {hasMaterials ? (
                materialLines.length > 1 ? (
                  <ul className="m-0 list-none space-y-1.5 p-0">
                    {materialLines.map((line, i) => (
                      <li key={`${i}-${line}`} className="flex gap-2">
                        <span className="text-emerald-600" aria-hidden>
                          •
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{materialLines[0]}</p>
                )
              ) : (
                <p className="text-slate-400">—</p>
              )}
            </div>
          </div>
        )}
      </div>

      {scanHint ? (
        <p className="mt-4 rounded-xl bg-gray-50/90 px-4 py-3 text-xs leading-relaxed text-gray-600">
          {scanHint}
        </p>
      ) : null}

      <div className="mt-5 flex items-start gap-3 border-t border-slate-100 pt-5">
        <CheckCircle2
          className="h-5 w-5 shrink-0 text-emerald-600"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold text-slate-900">DPP Compliance</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            Structured for the EU Digital Product Passport and audit-ready exports.
          </p>
        </div>
      </div>
    </div>
  )
}
