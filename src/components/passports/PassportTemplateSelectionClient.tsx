"use client"

import { useState } from "react"
import { Eye, Sparkles } from "lucide-react"
import { clsx } from "clsx"
import {
  PASSPORT_TEMPLATES,
  type PassportTemplateKey,
} from "@/lib/passport-display-templates"
import { useToast } from "@/components/ui/Toast"
import { PassportTemplatePreviewModal } from "@/components/templates/PassportTemplatePreviewModal"

export function PassportTemplateSelectionClient({
  initialTemplateKey,
}: {
  initialTemplateKey: PassportTemplateKey
}) {
  const toast = useToast()
  const [activeKey, setActiveKey] = useState<PassportTemplateKey>(initialTemplateKey)
  const [previewKey, setPreviewKey] = useState<PassportTemplateKey | null>(null)
  const [busyKey, setBusyKey] = useState<PassportTemplateKey | null>(null)

  async function applyTemplate(key: PassportTemplateKey) {
    setBusyKey(key)
    try {
      const res = await fetch("/api/profile/passport-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: key }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Could not save template.")
        return
      }
      setActiveKey(key)
      const meta = PASSPORT_TEMPLATES.find((t) => t.key === key)
      toast.success(meta?.successLabel ?? "Template applied successfully!")
    } catch {
      toast.error("Could not save template.")
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        {PASSPORT_TEMPLATES.map((t) => {
          const isActive = activeKey === t.key
          return (
            <div
              key={t.key}
              className={clsx(
                "relative flex flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition-all duration-200 dark:bg-slate-900",
                isActive
                  ? "border-2 border-indigo-600 dark:border-indigo-400"
                  : "border border-slate-200/80 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
              )}
            >
              {isActive ? (
                <span className="absolute right-4 top-4 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-950/60 dark:text-indigo-200">
                  ✓ Active
                </span>
              ) : null}

              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {t.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => applyTemplate(t.key)}
                  className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  {busyKey === t.key ? "Applying…" : "Use Template"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewKey(t.key)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
                >
                  <Eye className="h-4 w-4" aria-hidden />
                  Preview
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {previewKey ? (
        <PassportTemplatePreviewModal
          open={Boolean(previewKey)}
          onClose={() => setPreviewKey(null)}
          templateKey={previewKey}
        />
      ) : null}
    </>
  )
}
