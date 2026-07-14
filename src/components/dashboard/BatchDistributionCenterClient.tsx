"use client"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { ChevronDown, Download, ExternalLink, FileSpreadsheet, FileText, Globe } from "lucide-react"
import clsx from "clsx"
import { normalizeFilterProductId, productDisplayLabel } from "@/lib/product-display-label"
import { appendPassportPreviewQuery } from "@/lib/public-passport-consumer"
import { ProductPickerCombobox } from "@/components/dashboard/ProductPickerCombobox"
import { SECURE_PASSPORT_DESTINATION_LABEL } from "@/components/dashboard/qr-identity/DestinationTargetBlock"
import { useToast } from "@/components/ui/Toast"

type BatchDistributionRow = {
  id: string
  createdAt: string | null
  quantity: number
  productId: string | null
  productName: string | null
  /** Active passport id for customer scan URL; null if none */
  previewPassportId: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function BatchDistributionCenterClient({
  rows,
}: {
  rows: BatchDistributionRow[]
}) {
  const toast = useToast()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [exportedIds, setExportedIds] = useState<Record<string, true>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [filterProductId, setFilterProductId] = useState<string | null>(null)
  const effectiveFilterId = useMemo(() => normalizeFilterProductId(filterProductId), [filterProductId])

  const productPickerItems = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const r of rows) {
      if (!r.productId) continue
      if (!m.has(r.productId)) m.set(r.productId, r.productName)
    }
    return [...m.entries()].map(([productId, productName]) => ({ productId, productName }))
  }, [rows])

  const visibleRows = useMemo(
    () => rows.filter((r) => !effectiveFilterId || r.productId === effectiveFilterId),
    [rows, effectiveFilterId],
  )

  const visibleIds = useMemo(() => visibleRows.map((r) => r.id), [visibleRows])
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
  const hasSelection = selectedIds.length > 0

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(r.id)),
    [rows, selectedIds],
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])])
    }
  }

  async function copyBatchPreviewLink(passportId: string | null) {
    if (!passportId) {
      toast.error("No active passport for this batch’s product yet. Publish a passport to get a preview link.")
      return
    }
    const url = appendPassportPreviewQuery(`${window.location.origin}/scan/${passportId}`)
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Copied!")
    } catch {
      toast.error("Could not copy to clipboard.")
    }
  }

  function markExported(ids: string[]) {
    setExportedIds((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = true
      return next
    })
  }

  async function onExportHighResZip() {
    if (selectedRows.length === 0) return
    for (const row of selectedRows) {
      window.open(`/api/batches/${row.id}/qr-zip`, "_blank", "noopener,noreferrer")
    }
    markExported(selectedRows.map((r) => r.id))
    setMenuOpen(false)
  }

  async function onExportCsv() {
    if (selectedRows.length === 0) return
    const lines = ["batch_id,date_created,quantity"]
    for (const row of selectedRows) {
      lines.push(`${row.id},${row.createdAt ?? ""},${row.quantity}`)
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "originpass-batch-label-export.csv"
    a.click()
    URL.revokeObjectURL(url)
    markExported(selectedRows.map((r) => r.id))
    setMenuOpen(false)
  }

  async function onGeneratePrintPdf() {
    if (selectedRows.length === 0) return
    const selectedPayloads = await Promise.all(
      selectedRows.map(async (row) => {
        try {
          const res = await fetch(`/api/batches/${row.id}/regulatory-export-data`)
          if (!res.ok) return null
          const data = (await res.json()) as {
            batch?: { production_run_name?: string | null }
            product?: { name?: string | null }
            items?: Array<{ serial_id?: string | null }>
          }
          return {
            id: row.id,
            batchName: data.batch?.production_run_name ?? `Batch ${row.id.slice(0, 8)}`,
            productName: data.product?.name ?? "Product",
            serials: (data.items ?? [])
              .map((it) => it.serial_id)
              .filter((s): s is string => Boolean(s))
              .slice(0, 80),
          }
        } catch {
          return null
        }
      }),
    )
    const printable = selectedPayloads.filter(Boolean) as Array<{
      id: string
      batchName: string
      productName: string
      serials: string[]
    }>
    if (printable.length === 0) return

    const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700")
    if (!popup) return

    const qrBlocks = printable
      .map((batch) => {
        const cards = batch.serials
          .map((serial) => {
            const verifyUrl = `${window.location.origin}/verify/${serial}`
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(verifyUrl)}`
            return `<article style="width:220px;border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff;break-inside:avoid"><img src="${qrUrl}" alt="QR ${serial}" style="width:100%;height:auto;display:block"/><p style="margin-top:8px;font-family:monospace;font-size:10px;color:#334155">${serial}</p></article>`
          })
          .join("")
        return `<section style="margin-bottom:20px"><h3 style="margin:0 0 6px 0;font-size:14px;color:#0f172a">${batch.batchName}</h3><p style="margin:0 0 10px 0;font-size:12px;color:#64748b">${batch.productName}</p><div style="display:flex;flex-wrap:wrap;gap:10px">${cards}</div></section>`
      })
      .join("")
    popup.document.write(`<!doctype html><html><head><title>Print-ready QR export</title></head><body style="font-family:Inter,Arial,sans-serif;padding:24px"><h2 style="margin-top:0">Print-ready QR Labels</h2>${qrBlocks}<script>window.print()</script></body></html>`)
    popup.document.close()
    markExported(selectedRows.map((r) => r.id))
    setMenuOpen(false)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recent Batches</h2>
          <p className="text-sm text-slate-500">Distribution center for labels, print exports, and high-res QR files.</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={!hasSelection}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export Options
            <ChevronDown className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <button
                type="button"
                onClick={onGeneratePrintPdf}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" />
                Generate Print-Ready PDF
              </button>
              <button
                type="button"
                onClick={() => void onExportCsv()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export CSV for Labels
              </button>
              <button
                type="button"
                onClick={() => void onExportHighResZip()}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Download High-Res QR ZIP
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="border-b border-slate-100 px-6 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Product</p>
          <div className="w-full max-w-md">
          <ProductPickerCombobox
            items={productPickerItems}
            value={filterProductId}
            onChange={setFilterProductId}
            allowAll
            placeholder="Filter by Product Name..."
            disabled={productPickerItems.length === 0}
            className="max-w-md"
          />
          </div>
          {effectiveFilterId ? (
            <p className="mt-2 text-xs text-slate-500">
              Showing {visibleRows.length} of {rows.length} batch{rows.length !== 1 ? "es" : ""} for{" "}
              <span className="font-medium text-slate-700">
                {productDisplayLabel(
                  effectiveFilterId,
                  rows.find((r) => r.productId === effectiveFilterId)?.productName,
                )}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="max-w-xl text-sm text-slate-600">
            No QR Batches Found. Start by creating a new production run to generate secure identities for your products.
          </p>
          <Link href="/dashboard/batches?context=qr-identity" className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Create New Batch
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <input
                    aria-label="Select all visible batches"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Batch ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Target destination</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Export Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    No batches match this product filter.
                  </td>
                </tr>
              ) : null}
              {visibleRows.map((row) => {
                const selected = selectedIds.includes(row.id)
                const exported = Boolean(exportedIds[row.id])
                const productLabel =
                  row.productId != null
                    ? productDisplayLabel(row.productId, row.productName)
                    : "—"
                return (
                  <tr key={row.id} className={clsx("hover:bg-slate-50", selected && "bg-slate-50")}>
                    <td className="px-6 py-4">
                      <input
                        aria-label={`Select batch ${row.id}`}
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(row.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">{row.id.slice(0, 8)}</td>
                    <td className="max-w-[220px] truncate px-6 py-4 text-sm text-slate-800" title={productLabel}>
                      {productLabel}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(row.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.quantity}</td>
                    <td className="max-w-[220px] px-6 py-4">
                      <div className="flex items-start gap-2">
                        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-snug text-slate-800">
                            {SECURE_PASSPORT_DESTINATION_LABEL}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void copyBatchPreviewLink(row.previewPassportId)
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden />
                            Copy preview link
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                          exported
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-700",
                        )}
                      >
                        {exported ? "Downloaded" : "Not Exported"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
