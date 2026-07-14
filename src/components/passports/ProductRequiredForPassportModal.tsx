"use client"

import { useEffect, useState } from "react"
import { Package } from "lucide-react"
import { useRouter } from "@/i18n/navigation"
import { clsx } from "clsx"

const PRODUCTS_FOCUS_AI = "/dashboard/products?focusAi=1"
const MANUAL_WIZARD = "/dashboard/products/passport-wizard?step=1&flow=compliance"

export function ProductRequiredForPassportModal() {
  const router = useRouter()
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-required-passport-title"
    >
      <div
        className={clsx(
          "w-full max-w-md transform rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition duration-200 ease-out dark:border-slate-700 dark:bg-slate-900",
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400">
          <Package className="h-6 w-6" aria-hidden />
        </div>
        <h2
          id="product-required-passport-title"
          className="text-center text-lg font-bold text-slate-900 dark:text-slate-100"
        >
          Let&apos;s list your product first
        </h2>
        <p className="mt-2 mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          To generate a compliant Digital Product Passport, we first need to pair it with a registered product. It only
          takes a minute!
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            onClick={() => router.push(PRODUCTS_FOCUS_AI)}
          >
            <span aria-hidden>✨</span>
            Auto-Fill with AI
          </button>
          <button
            type="button"
            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => router.push(MANUAL_WIZARD)}
          >
            <span aria-hidden>📝</span>
            Manual Entry
          </button>
        </div>
      </div>
    </div>
  )
}
