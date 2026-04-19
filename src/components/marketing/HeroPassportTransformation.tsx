import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  FileText,
  ImageIcon,
  Layers,
  MapPin,
  QrCode,
} from "lucide-react"

/**
 * Hero visual: raw product record → verified passport (replaces static SVG wireframe).
 */
export function HeroPassportTransformation() {
  return (
    <div className="w-full max-w-xl">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 lg:text-left">
        From raw data to verified passport
      </p>

      <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-stretch md:gap-2">
        {/* Draft card */}
        <article
          className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200/90 bg-slate-50 p-4 text-slate-700 shadow-none"
          aria-label="Product record draft example"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="text-left text-[15px] font-semibold leading-tight tracking-tight text-slate-800">
              Product Record (Draft)
            </h2>
            <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Draft
            </span>
          </div>

          <div className="flex flex-col gap-2 text-[13px] leading-snug">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
              <span className="shrink-0 text-slate-500">Product Name</span>
              <span className="font-medium text-slate-700 sm:text-right">Heritage Leather Tote</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
              <span className="shrink-0 text-slate-500">SKU</span>
              <span className="font-medium text-slate-700 sm:text-right">HLT-AW26-001</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
              <span className="shrink-0 text-slate-500">Batch</span>
              <span className="font-medium text-slate-700 sm:text-right">AW-26</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
              <span className="shrink-0 text-slate-500">Artisan</span>
              <span className="font-medium text-slate-700 sm:text-right">Aurum Atelier</span>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-200/80 pt-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
              Origin
            </div>
            <p className="mt-1.5 pl-5 text-[13px] text-slate-600">
              Italy <span aria-hidden>🇮🇹</span> (Tuscany)
            </p>
          </div>

          <div className="mt-3 border-t border-slate-200/80 pt-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
              <Layers className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
              Materials
            </div>
            <ul className="mt-1.5 space-y-1 pl-1 text-[13px] leading-snug text-slate-600">
              <li>• Full-grain leather – Italy</li>
              <li>• Organic cotton lining – Portugal</li>
            </ul>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-200/80 pt-3">
            <div className="flex items-center gap-1.5 text-slate-500" aria-hidden>
              <FileText className="h-3.5 w-3.5" strokeWidth={2} />
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
              <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
            <span className="text-[12px] text-slate-500">3 files uploaded</span>
          </div>
        </article>

        {/* Connector */}
        <div
          className="flex shrink-0 flex-col items-center justify-center py-1 md:w-10 md:py-0"
          aria-hidden
        >
          <div className="flex flex-col items-center gap-2 md:hidden">
            <div className="h-6 w-px bg-gradient-to-b from-slate-200 via-slate-300 to-emerald-200/70" />
            <ArrowDown className="h-5 w-5 text-slate-400" strokeWidth={2} />
            <div className="h-6 w-px bg-gradient-to-b from-emerald-200/70 via-slate-300 to-slate-200" />
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <div className="h-px w-5 bg-gradient-to-r from-slate-200 to-emerald-300/60" />
            <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={2} />
            <div className="h-px w-5 bg-gradient-to-l from-slate-200 to-emerald-300/60" />
          </div>
        </div>

        {/* Verified passport */}
        <article
          className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[20px] border border-emerald-200/60 bg-white p-4 text-slate-800 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.12)]"
          aria-label="Verified product passport example"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 className="text-left text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
              Verified Product Passport
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Verified
              <span className="text-emerald-600" aria-hidden>
                ✓
              </span>
            </span>
          </div>

          <p className="text-[16px] font-bold leading-snug text-slate-900">Heritage Leather Tote</p>

          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Materials</p>
              <ul className="mt-1.5 space-y-1 text-[13px] leading-snug text-slate-600">
                <li>• Full-grain leather – Italy</li>
                <li>• Organic cotton lining – Portugal</li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Supply Chain</p>
              <p className="mt-1.5 text-[13px] font-medium text-slate-700">Farm → Tannery → Workshop</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Certifications</p>
              <ul className="mt-1.5 space-y-1 text-[13px] leading-snug text-slate-600">
                <li>• EUDR Compliant</li>
                <li>• ESG Verified</li>
              </ul>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-[13px] text-slate-700">
              <span className="font-semibold text-slate-800">Owned by:</span> Aurum Atelier
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-[12px] font-medium text-emerald-900">
            <QrCode className="h-4 w-4 shrink-0 text-emerald-700" strokeWidth={2} aria-hidden />
            Scan to view passport
          </div>
        </article>
      </div>
    </div>
  )
}
