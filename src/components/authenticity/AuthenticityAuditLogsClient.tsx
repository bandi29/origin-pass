"use client"

import { useMemo, useState } from "react"
import type { AuditLogEntry } from "@/lib/authenticity-intelligence"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { DatePicker } from "@/components/ui/DatePicker"
import { FileJson, FileSpreadsheet, ScrollText } from "lucide-react"
import clsx from "clsx"

function formatTs(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function downloadBlob(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function startOfDayLocal(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** YYYY-MM-DD in local calendar (matches DatePicker / audit filters). */
function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function defaultFromDate() {
  const t = startOfDayLocal(new Date())
  const f = new Date(t)
  f.setMonth(f.getMonth() - 1)
  return toLocalISODate(f)
}

function defaultToDate() {
  return toLocalISODate(startOfDayLocal(new Date()))
}

export function AuthenticityAuditLogsClient({
  initialRows,
}: {
  initialRows: AuditLogEntry[]
}) {
  const [rows] = useState<AuditLogEntry[]>(initialRows)
  const [from, setFrom] = useState(defaultFromDate)
  const [to, setTo] = useState(defaultToDate)
  const [product, setProduct] = useState("")
  const [resultFilter, setResultFilter] = useState<"" | "Success" | "Failed">("")

  const productOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.product_id))
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (product && r.product_id !== product) return false
      if (resultFilter && r.result !== resultFilter) return false
      const t = new Date(r.timestamp).getTime()
      if (from && t < new Date(from).getTime()) return false
      if (to && t > new Date(to).getTime() + 86400000) return false
      return true
    })
  }, [rows, product, resultFilter, from, to])

  const exportCsv = () => {
    const header = [
      "event_id",
      "product_id",
      "action",
      "result",
      "location",
      "timestamp",
      "actor",
    ]
    const lines = [
      header.join(","),
      ...filtered.map((r) =>
        [
          r.event_id,
          r.product_id,
          r.action,
          r.result,
          `"${r.location.replace(/"/g, '""')}"`,
          r.timestamp,
          r.actor,
        ].join(",")
      ),
    ]
    downloadBlob("originpass-audit-log.csv", "text/csv;charset=utf-8", lines.join("\n"))
  }

  const exportJson = () => {
    downloadBlob(
      "originpass-audit-log.json",
      "application/json",
      JSON.stringify(filtered, null, 2)
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <ScrollText className="h-5 w-5 shrink-0 text-emerald-800" aria-hidden />
          <p className="text-sm font-medium text-emerald-950">
            EU-Registry Ready: Every product generates a verifiable, machine-readable audit trail.
            Instantly export compliant data for EU regulators and retail partners.
          </p>
        </div>
      </div>

      <Card
        padding
        className="rounded-2xl border border-ds-border bg-[#F9FAFB] shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="audit-from" className="text-xs font-medium text-ds-text-muted">
              From
            </label>
            <DatePicker
              id="audit-from"
              value={from}
              onChange={setFrom}
              placeholder="mm/dd/yyyy"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="audit-to" className="text-xs font-medium text-ds-text-muted">
              To
            </label>
            <DatePicker
              id="audit-to"
              value={to}
              onChange={setTo}
              placeholder="mm/dd/yyyy"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="audit-product" className="text-xs font-medium text-ds-text-muted">
              Product
            </label>
            <select
              id="audit-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className={clsx(
                "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm",
                "focus:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary/30"
              )}
            >
              <option value="">All products</option>
              {productOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="audit-result" className="text-xs font-medium text-ds-text-muted">
              Result
            </label>
            <select
              id="audit-result"
              value={resultFilter}
              onChange={(e) =>
                setResultFilter(e.target.value as "" | "Success" | "Failed")
              }
              className={clsx(
                "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm",
                "focus:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary/30"
              )}
            >
              <option value="">All</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportJson}>
            <FileJson className="h-4 w-4" aria-hidden />
            Export JSON
          </Button>
        </div>
      </Card>

      <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-ds-border text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                <th className="whitespace-nowrap pb-3 pr-4">Event ID</th>
                <th className="whitespace-nowrap pb-3 pr-4">Product ID</th>
                <th className="whitespace-nowrap pb-3 pr-4">Action</th>
                <th className="whitespace-nowrap pb-3 pr-4">Result</th>
                <th className="whitespace-nowrap pb-3 pr-4">Location</th>
                <th className="whitespace-nowrap pb-3 pr-4">Timestamp</th>
                <th className="whitespace-nowrap pb-3">User / system</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {filtered.map((r) => (
                <tr key={r.event_id} className="hover:bg-[#F9FAFB]">
                  <td className="py-3 pr-4 font-mono text-xs text-ds-text">{r.event_id}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ds-text-muted">
                    {r.product_id}
                  </td>
                  <td className="py-3 pr-4 text-ds-text">{r.action}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={clsx(
                        "rounded-lg px-2 py-0.5 text-xs font-medium",
                        r.result === "Success"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-red-50 text-red-800"
                      )}
                    >
                      {r.result}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-ds-text-muted">{r.location}</td>
                  <td className="py-3 pr-4 text-ds-text-muted">{formatTs(r.timestamp)}</td>
                  <td className="py-3 font-mono text-xs text-ds-text-muted">{r.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-ds-text-muted">
          Showing {filtered.length} of {rows.length} events
        </p>
      </Card>
    </div>
  )
}
