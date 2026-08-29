"use client"

import { LayoutTemplate } from "lucide-react"
import {
  INDUSTRY_TEMPLATE_LIST,
  type IndustryTemplateId,
} from "@/lib/templates"

type Props = {
  value: IndustryTemplateId | ""
  onSelect: (id: IndustryTemplateId) => void
  cardClass: string
}

export function IndustryTemplatePicker({ value, onSelect, cardClass }: Props) {
  return (
    <div className={cardClass}>
      <div className="flex items-start gap-2.5">
        <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Start from template</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Prefill story, materials, timeline, and industry fields. You can edit everything after.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {INDUSTRY_TEMPLATE_LIST.map((tpl) => {
              const active = value === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onSelect(tpl.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
                    {tpl.label}
                  </p>
                  <p className={`mt-1 text-xs leading-snug ${active ? "text-slate-300" : "text-slate-500"}`}>
                    {tpl.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
