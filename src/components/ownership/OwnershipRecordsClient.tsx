"use client"

import { useState } from "react"
import clsx from "clsx"
import { FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import type { OwnershipRecordRow } from "@/lib/ownership-records-types"

const TABLE_COLUMNS = [
  { id: "registrationId", header: "REGISTRATION ID" },
  { id: "product", header: "PRODUCT SKU / NAME" },
  { id: "owner", header: "CURRENT VERIFIED OWNER" },
  { id: "warranty", header: "WARRANTY TIMEFRAME" },
  { id: "registeredAt", header: "REGISTRATION DATE" },
] as const

function formatRegistrationDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatWarrantyDate(iso: string | null) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso))
  } catch {
    return iso
  }
}

function warrantyLabel(row: OwnershipRecordRow) {
  const expires = formatWarrantyDate(row.warrantyExpiresAt)
  if (row.warrantyStatus === "pending") return "Pending activation"
  if (row.warrantyStatus === "expired") {
    return expires ? `Expired · ${expires}` : "Expired"
  }
  return expires ? `Active · Expires ${expires}` : "Active"
}

function downloadBlob(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportOwnershipRecordsCsv(rows: OwnershipRecordRow[]) {
  const header = [
    "registration_id",
    "product_sku",
    "product_name",
    "verified_owner",
    "warranty_timeframe",
    "registration_date",
  ]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.registrationId,
        row.productSku,
        `"${row.productName.replace(/"/g, '""')}"`,
        `"${row.ownerLabel.replace(/"/g, '""')}"`,
        `"${warrantyLabel(row).replace(/"/g, '""')}"`,
        row.registeredAt,
      ].join(","),
    ),
  ]
  downloadBlob(
    "originpass-ownership-records.csv",
    "text/csv;charset=utf-8",
    lines.join("\n"),
  )
}

function WarrantyBadge({ row }: { row: OwnershipRecordRow }) {
  const label = warrantyLabel(row)
  return (
    <span
      className={clsx(
        "inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium",
        row.warrantyStatus === "active" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        row.warrantyStatus === "expired" &&
          "border-slate-200 bg-slate-50 text-slate-600",
        row.warrantyStatus === "pending" &&
          "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {label}
    </span>
  )
}

export function OwnershipRecordsClient({
  initialRows,
}: {
  initialRows: OwnershipRecordRow[]
}) {
  const [rows] = useState(initialRows)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ownership records</h2>
          <p className="mt-1 text-sm text-slate-500">
            Verified ownership registrations across your product passport network.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => exportOwnershipRecordsCsv(rows)}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Export
        </Button>
      </div>

      <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">
            Registration ledger
          </p>
          <p className="text-xs text-ds-text-muted">
            {rows.length} verified registration{rows.length === 1 ? "" : "s"}
          </p>
        </div>

        <OwnershipRecordsTable rows={rows} />
      </Card>
    </div>
  )
}

function OwnershipRecordsTable({ rows }: { rows: OwnershipRecordRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ds-text-muted">
        No ownership registrations yet. Claims appear here after consumers verify and register a
        passport.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-ds-border text-xs font-medium uppercase tracking-wide text-ds-text-muted">
            {TABLE_COLUMNS.map((col) => (
              <th key={col.id} className="whitespace-nowrap pb-3 pr-4">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ds-border">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-slate-50/90">
              <td className="py-4 pr-4 font-mono text-sm text-ds-text">{row.registrationId}</td>
              <td className="py-4 pr-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs text-ds-text-muted">{row.productSku}</span>
                  <span className="font-medium text-ds-text">{row.productName}</span>
                </div>
              </td>
              <td className="py-4 pr-4 text-ds-text">{row.ownerLabel}</td>
              <td className="py-4 pr-4">
                <WarrantyBadge row={row} />
              </td>
              <td className="py-4 pr-4 tabular-nums text-ds-text-muted">
                {formatRegistrationDate(row.registeredAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
