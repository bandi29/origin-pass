"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { BookOpenCheck, Search, X } from "lucide-react"
import { clsx } from "clsx"
import { PassportsModuleSegmentedNav } from "@/components/passports/PassportsModuleSegmentedNav"
import {
  PASSPORT_REGISTRY_PAGE_SIZE,
  PassportRegistryTable,
} from "@/components/passports/PassportRegistryTable"
import { OnboardingEmptyState } from "@/components/ui/OnboardingEmptyState"
import { useToast } from "@/components/ui/Toast"
import {
  productNameMatchesQuerySlug,
  type PassportRegistryRow,
} from "@/lib/passport-registry-map"

type Props = {
  rows: PassportRegistryRow[]
  viewKey: string
  viewThisMonth: boolean
  /** Total passports in current server filter (All / This month), shown in header. */
  totalCount: number
}

const viewToggleTrackClass = clsx(
  "inline-flex shrink-0 rounded-xl border border-slate-200/70 bg-slate-100/70 p-1",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-sm",
)

const viewToggleBase = clsx(
  "rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2",
)

const viewToggleActive = clsx(
  viewToggleBase,
  "bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_-4px_rgba(15,23,42,0.12)]",
)

const viewToggleInactive = clsx(
  viewToggleBase,
  "text-slate-500 hover:bg-white/60 hover:text-slate-800",
)

const searchInputClass = clsx(
  "h-14 w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 pl-12 pr-12",
  "text-[15px] text-slate-900 placeholder:text-slate-400/75",
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-6px_rgba(15,23,42,0.06)]",
  "backdrop-blur-sm outline-none transition-all duration-200 ease-out",
  "hover:border-slate-300/80 hover:bg-white hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)]",
  "focus:border-slate-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(148,163,184,0.14),0_4px_20px_-4px_rgba(15,23,42,0.1)]",
  "focus:ring-0",
)

export function PassportRegistryClientBlock({ rows, viewKey, viewThisMonth, totalCount }: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [highlightRowId, setHighlightRowId] = useState<string | null>(null)
  const [highlightPage, setHighlightPage] = useState<number | null>(null)
  const successLandingHandledRef = useRef(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    if (successLandingHandledRef.current) return
    if (searchParams.get("success") !== "true") return

    successLandingHandledRef.current = true

    toast.success("Success! Your Digital Product Passport is now live and scannable.")

    const productSlug = searchParams.get("product")?.trim() ?? ""
    const match =
      productSlug.length > 0
        ? rows.find((row) => productNameMatchesQuerySlug(row.productName, productSlug))
        : rows[0]

    if (match) {
      const rowIndex = rows.findIndex((row) => row.id === match.id)
      if (rowIndex >= 0) {
        setHighlightPage(Math.floor(rowIndex / PASSPORT_REGISTRY_PAGE_SIZE))
      }
      setHighlightRowId(match.id)
    }

    router.replace("/dashboard/product-passports")
  }, [rows, router, searchParams, toast])

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return rows
    return rows.filter((passport) => {
      return (
        passport.serial_id.toLowerCase().includes(q) ||
        passport.productName.toLowerCase().includes(q) ||
        passport.batchName.toLowerCase().includes(q)
      )
    })
  }, [rows, searchQuery])

  if (rows.length === 0) {
    return (
      <div className="px-8 py-10">
        <OnboardingEmptyState
          icon={<BookOpenCheck className="h-6 w-6" />}
          heading="Create your first digital product passport"
          body="Get your artisan products ready for EU ESPR standards by building an immutable, traceable identity carrier."
          primaryAction={{
            label: "Build a Passport",
            href: "/dashboard/product-passports/create",
          }}
          secondaryAction={{ label: "View products", href: "/dashboard/products" }}
        />
      </div>
    )
  }

  return (
    <>
      <div className="border-b border-slate-200/50 bg-gradient-to-b from-white via-white to-slate-50/40 px-8 pb-8 pt-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
            <div>
              <h2 className="text-[2.125rem] font-bold leading-[1.15] tracking-[-0.02em] text-slate-950">
                {viewThisMonth ? "This Month" : "All Passports"}
              </h2>
              {!viewThisMonth ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                  Passports are automatically linked and managed via the main Product creation wizard.
                </p>
              ) : null}
              <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                {totalCount} passport{totalCount !== 1 ? "s" : ""}
              </p>
            </div>

            <div className={viewToggleTrackClass} role="group" aria-label="Passport date range">
              <Link
                href="/dashboard/product-passports"
                className={!viewThisMonth ? viewToggleActive : viewToggleInactive}
                aria-current={!viewThisMonth ? "page" : undefined}
              >
                All
              </Link>
              <Link
                href="/dashboard/product-passports?view=this-month"
                className={viewThisMonth ? viewToggleActive : viewToggleInactive}
                aria-current={viewThisMonth ? "page" : undefined}
              >
                This month
              </Link>
            </div>
          </div>

          <div className="w-full lg:max-w-[440px] lg:shrink-0">
            <div className="relative min-w-0">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center"
                aria-hidden
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(15,23,42,0.04)]">
                  <Search className="h-[18px] w-[18px] stroke-[2] text-slate-400" />
                </div>
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search serial, product, or batch..."
                className={searchInputClass}
                autoComplete="off"
                spellCheck={false}
                aria-label="Search passports"
              />
              {searchQuery.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition-all duration-200 ease-out hover:bg-slate-900/[0.05] hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 stroke-[2]" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-6 pt-8">
        <PassportsModuleSegmentedNav />
      </div>

      {filteredRows.length === 0 ? (
        <div className="border-t border-slate-200/50 px-8 py-14 text-center text-sm text-slate-500">
          No passports match your search.
        </div>
      ) : (
        <PassportRegistryTable
          rows={filteredRows}
          viewKey={viewKey}
          pageResetKey={searchQuery}
          pageOverride={highlightPage}
          highlightRowId={highlightRowId}
        />
      )}
    </>
  )
}
