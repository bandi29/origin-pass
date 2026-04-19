"use client"

import { Info } from "lucide-react"

interface FieldTooltipProps {
  label: string
  description: string
  whyMatters: string
}

export function FieldTooltip({ label, description, whyMatters }: FieldTooltipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex items-center text-slate-400 hover:text-slate-600 cursor-help p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-slate-300"
        aria-label={`${label}: ${description}. EU DPP: ${whyMatters}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block group-focus-within:block z-50 w-64 px-3 py-2.5 text-xs text-left bg-slate-800 text-white rounded-lg shadow-lg pointer-events-none">
        <span className="block font-medium text-slate-100">{description}</span>
        <span className="block mt-1.5 text-emerald-200/90">Why this matters for EU DPP: {whyMatters}</span>
        <span className="absolute left-1/2 -translate-x-1/2 top-full border-[6px] border-transparent border-t-slate-800" />
      </span>
    </span>
  )
}
