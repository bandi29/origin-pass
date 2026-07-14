"use client"

import { useEffect, useState } from "react"
import clsx from "clsx"
import { useRouter } from "@/i18n/navigation"
import CategoryAwareProductForm from "@/components/dashboard/CategoryAwareProductForm"

type AddProductWorkspaceProps = {
  /** When true (e.g. `?focusAi=1` from passport intercept), AI path is selected and the file picker opens after navigation. */
  autoTriggerAiUpload?: boolean
}

export default function AddProductWorkspace({ autoTriggerAiUpload = false }: AddProductWorkspaceProps) {
  const router = useRouter()
  const [aiPathActive, setAiPathActive] = useState(true)

  useEffect(() => {
    if (autoTriggerAiUpload) setAiPathActive(true)
  }, [autoTriggerAiUpload])

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setAiPathActive(true)}
          className={clsx(
            "flex min-h-[3rem] items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all duration-200",
            aiPathActive
              ? "border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 text-emerald-950 shadow-md ring-2 ring-emerald-500/20"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          <span className="text-lg" aria-hidden>
            ✨
          </span>
          Auto-fill with AI
        </button>
        <button
          type="button"
          onClick={() => {
            setAiPathActive(false)
            router.push("/dashboard/products/passport-wizard?step=1&flow=compliance")
          }}
          className="flex min-h-[3rem] items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-800 hover:bg-slate-50 hover:text-slate-900"
        >
          <span className="text-lg" aria-hidden>
            📝
          </span>
          Manual Entry
        </button>
      </div>

      {aiPathActive ? (
        <CategoryAwareProductForm
          aiPathOnly
          autoTriggerAiPicker={autoTriggerAiUpload}
          onProductCreated={({ productId }) => {
            router.push(
              `/dashboard/products/passport-wizard?step=2&flow=compliance&productId=${encodeURIComponent(productId)}`,
            )
          }}
        />
      ) : null}
    </div>
  )
}
