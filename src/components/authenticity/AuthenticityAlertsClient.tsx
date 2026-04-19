"use client"

import { useCallback, useEffect, useState } from "react"
import {
  formatIssueType,
  type AlertSeverity,
  type AlertStatus,
  type CounterfeitAlert,
} from "@/lib/authenticity-dashboard-data"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { createPortal } from "react-dom"
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  MapPin,
  X,
} from "lucide-react"
import clsx from "clsx"
import { AnimatePresence, motion } from "framer-motion"

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const styles = {
    low: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
    medium: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
    high: "bg-red-50 text-red-800 ring-1 ring-red-200/80",
  } as const
  const labels = { low: "Low", medium: "Medium", high: "High" } as const
  return (
    <Badge className={clsx("rounded-lg font-medium capitalize", styles[severity])}>
      {labels[severity]}
    </Badge>
  )
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const styles = {
    open: "bg-slate-100 text-slate-800",
    investigating: "bg-indigo-50 text-indigo-900",
    resolved: "bg-emerald-50 text-emerald-800",
  } as const
  const labels = {
    open: "Open",
    investigating: "Investigating",
    resolved: "Resolved",
  } as const
  return (
    <Badge className={clsx("rounded-lg font-medium capitalize", styles[status])}>
      {labels[status]}
    </Badge>
  )
}

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

function AlertDetailDrawer({
  alert,
  open,
  onClose,
  onResolve,
  onFlag,
}: {
  alert: CounterfeitAlert | null
  open: boolean
  onClose: () => void
  onResolve: (id: string) => void
  onFlag: (id: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!mounted || typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open && alert ? (
        <motion.div
          className="fixed inset-0 z-[200]"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label="Close panel"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-drawer-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-ds-border bg-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ds-border p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                  {alert.alert_id}
                </p>
                <h2
                  id="alert-drawer-title"
                  className="mt-1 text-lg font-semibold text-ds-text"
                >
                  {alert.product_name}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <SeverityBadge severity={alert.severity} />
                  <StatusBadge status={alert.status} />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-ds-text-muted hover:bg-slate-100 hover:text-ds-text"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
                  Issue
                </h3>
                <p className="mt-2 text-sm text-ds-text">
                  {formatIssueType(alert.issue_type)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ds-text-muted">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {alert.location}
                </p>
                <p className="mt-2 text-xs text-ds-text-muted">
                  {formatTs(alert.timestamp)}
                </p>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
                  Scan history
                </h3>
                <ul className="mt-3 space-y-3">
                  {alert.scan_history.map((s, i) => (
                    <li
                      key={`${s.at}-${i}`}
                      className="rounded-xl border border-ds-border bg-[#F9FAFB] px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-ds-text">{s.event}</p>
                      {s.location ? (
                        <p className="text-xs text-ds-text-muted">{s.location}</p>
                      ) : null}
                      <p className="text-xs text-ds-text-muted">{formatTs(s.at)}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
                  Map preview
                </h3>
                <div className="mt-3 flex h-36 items-center justify-center rounded-2xl border border-dashed border-ds-border bg-slate-50 text-center text-xs text-ds-text-muted">
                  Static map placeholder
                  <br />
                  {alert.location}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
                  Timeline
                </h3>
                <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
                  {alert.timeline.map((t, i) => (
                    <li key={`${t.at}-${i}`} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-400" />
                      <p className="font-medium text-ds-text">{t.label}</p>
                      <p className="text-xs text-ds-text-muted">{formatTs(t.at)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className="border-t border-ds-border p-5 space-y-2">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => {
                  onResolve(alert.alert_id)
                  onClose()
                }}
                disabled={alert.status === "resolved"}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Mark as resolved
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onFlag(alert.alert_id)}
              >
                <Flag className="h-4 w-4" aria-hidden />
                Flag product
              </Button>
              <Button type="button" variant="outline" className="w-full">
                Notify admin
              </Button>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

export function AuthenticityAlertsClient({
  initialAlerts,
}: {
  initialAlerts: CounterfeitAlert[]
}) {
  const [alerts, setAlerts] = useState<CounterfeitAlert[]>(initialAlerts)
  const [active, setActive] = useState<CounterfeitAlert | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const openAlert = useCallback((a: CounterfeitAlert) => {
    setActive(a)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setActive(null)
  }, [])

  const onResolve = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.alert_id === id ? { ...a, status: "resolved" as const } : a
      )
    )
  }, [])

  const onFlag = useCallback((_id: string) => {
    /* mock: could open another modal */
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <p className="text-sm text-amber-950/90">
          Non-valid scans from your passports in the last 90 days. Resolve or flag items to
          triage your risk queue (status updates are local until persisted).
        </p>
      </div>

      <Card
        padding
        className="rounded-2xl border border-ds-border bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-ds-border text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                <th className="whitespace-nowrap pb-3 pr-4">Alert ID</th>
                <th className="whitespace-nowrap pb-3 pr-4">Product</th>
                <th className="whitespace-nowrap pb-3 pr-4">Issue type</th>
                <th className="whitespace-nowrap pb-3 pr-4">Severity</th>
                <th className="whitespace-nowrap pb-3 pr-4">Location</th>
                <th className="whitespace-nowrap pb-3 pr-4">Timestamp</th>
                <th className="whitespace-nowrap pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ds-border">
              {alerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-sm text-ds-text-muted"
                  >
                    No suspicious or failed scans in the last 90 days.
                  </td>
                </tr>
              ) : null}
              {alerts.map((row) => (
                <tr
                  key={row.alert_id}
                  className="cursor-pointer transition-colors hover:bg-[#F9FAFB]"
                  onClick={() => openAlert(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openAlert(row)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open alert ${row.alert_id}`}
                >
                  <td className="py-3 pr-4 font-mono text-xs text-ds-text">
                    {row.alert_id}
                  </td>
                  <td className="py-3 pr-4 font-medium text-ds-text">
                    {row.product_name}
                  </td>
                  <td className="py-3 pr-4 text-ds-text-muted">
                    {formatIssueType(row.issue_type)}
                  </td>
                  <td className="py-3 pr-4">
                    <SeverityBadge severity={row.severity} />
                  </td>
                  <td className="py-3 pr-4 text-ds-text-muted">{row.location}</td>
                  <td className="py-3 pr-4 text-ds-text-muted">
                    {formatTs(row.timestamp)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDetailDrawer
        alert={active}
        open={drawerOpen}
        onClose={closeDrawer}
        onResolve={onResolve}
        onFlag={onFlag}
      />
    </div>
  )
}
