"use client"

import { Link } from "@/i18n/navigation"
import type { OwnershipWithProduct } from "@/backend/modules/ownership/service"
import { Package, ShieldCheck } from "lucide-react"

type OwnershipHistoryClientProps = {
  initialRecords: OwnershipWithProduct[]
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function OwnershipHistoryClient({
  initialRecords,
}: OwnershipHistoryClientProps) {
  if (initialRecords.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <Package className="h-7 w-7 text-slate-500" />
        </div>
        <p className="mt-4 text-slate-600">No claimed products yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          Scan a product QR code and claim ownership to see your products here.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-slate-900 underline"
        >
          Go to home
        </Link>
      </div>
    )
  }

  return (
    <ul className="mt-6 space-y-3">
      {initialRecords.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">
                  {r.product_name ?? "Product"}
                </h2>
                {r.status === "claimed" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    Current owner
                  </span>
                )}
              </div>
              {r.brand_name && (
                <p className="mt-0.5 text-sm text-slate-500">{r.brand_name}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>Claimed {formatDate(r.claimed_at)}</span>
                {r.warranty_start_date && (
                  <span>Warranty from {formatDate(r.warranty_start_date)}</span>
                )}
              </div>
            </div>
            {r.serial_id && (
              <Link
                href={`/verify/${r.serial_id}`}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View passport
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
