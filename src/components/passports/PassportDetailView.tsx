"use client"

import { useState } from "react"
import {
  LayoutGrid,
  QrCode,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  ExternalLink,
} from "lucide-react"
import { Link } from "@/i18n/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { useRegisterBreadcrumbLabel } from "@/components/layout/BreadcrumbOverrides"
import { PassportStatusBadgeWithTooltip } from "./PassportStatusBadgeWithTooltip"
import { PassportContentTab } from "./PassportContentTab"
import { PassportOverviewTab } from "./PassportOverviewTab"
import { PassportQRTab } from "./PassportQRTab"
import { PassportScansTab } from "./PassportScansTab"
import { PassportLifecycleManagementPanel } from "./PassportLifecycleManagementPanel"
import { PassportVerificationPanel } from "./PassportVerificationPanel"
import type { PassportContentRecord } from "@/lib/passport-detail-server"
import type { PassportLifecycleAction } from "@/lib/passport-lifecycle-management"
import type {
  PassportVerificationComplianceStatus,
  PassportVerificationHistoryEntry,
} from "@/lib/passport-verification-management"

type TabId = "content" | "overview" | "qr" | "scans" | "verification" | "settings"

type TabDef = { id: TabId; label: string; icon: typeof LayoutGrid; danger?: boolean }

/** Read-only monitoring tabs — the detail "command center". */
const MONITORING_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "qr", label: "QR Code", icon: QrCode },
  { id: "scans", label: "Scan Activity", icon: Activity },
  { id: "verification", label: "Verification Status", icon: ShieldCheck },
]

/** Editing workspace tabs — the dedicated edit canvas. */
const EDIT_TABS: TabDef[] = [
  { id: "content", label: "Passport Content", icon: Pencil },
  { id: "settings", label: "Lifecycle Management", icon: ShieldAlert, danger: true },
]

type PassportDetailViewProps = {
  passport: {
    id: string
    passportUid: string
    productId: string
    productName?: string
    serialNumber: string
    verifyToken?: string
    status: string
    createdAt: string
  }
  content: PassportContentRecord
  scans: Array<{
    id: string
    scan_timestamp: string
    location_country: string | null
    location_city: string | null
    device_type: string | null
    scan_result: string
  }>
  defaultTab?: string
  baseUrl: string
  verificationComplianceStatus: PassportVerificationComplianceStatus
  verificationHistory: PassportVerificationHistoryEntry[]
  mode?: "view" | "edit"
}

export function PassportDetailView({
  passport,
  content,
  scans,
  defaultTab = "overview",
  baseUrl,
  verificationComplianceStatus,
  verificationHistory,
  mode = "view",
}: PassportDetailViewProps) {
  const tabs = mode === "edit" ? EDIT_TABS : MONITORING_TABS
  const [activeTab, setActiveTab] = useState<TabId>(
    tabs.some((t) => t.id === defaultTab) ? (defaultTab as TabId) : tabs[0].id,
  )
  const [currentStatus, setCurrentStatus] = useState(passport.status)
  const [lifecycleAction, setLifecycleAction] = useState<PassportLifecycleAction | null>(null)

  // Surface the serial in the global breadcrumb (the URL only carries the UUID).
  useRegisterBreadcrumbLabel(passport.id, passport.serialNumber)

  const passportWithStatus = { ...passport, status: currentStatus }

  const verifyHref = `${baseUrl}/verify/${passport.passportUid}`

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === "edit" ? "Edit passport" : "Passport details"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2 text-slate-600">
            <code className="text-sm font-mono text-slate-800">{passport.serialNumber}</code>
            <PassportStatusBadgeWithTooltip status={currentStatus} lifecycleAction={lifecycleAction} />
          </span>
        }
        contextBadge={
          passport.productName ? `Product: ${passport.productName}` : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={verifyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              View Live Passport
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            {mode === "view" ? (
              <Link
                href={`/dashboard/product-passports/${passport.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
              >
                Edit Content
                <Pencil className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const className = tab.danger
              ? `flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-medium transition ${
                  isActive
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-rose-500/80 hover:border-rose-300 hover:text-rose-700"
                }`
              : `flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-medium transition ${
                  isActive
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={className}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {activeTab === "content" && (
          <PassportContentTab passportId={passport.id} initialContent={content} />
        )}
        {activeTab === "overview" && (
          <PassportOverviewTab passport={passportWithStatus} />
        )}
        {activeTab === "qr" && (
          <PassportQRTab
            passportUid={passport.passportUid}
            serialNumber={passport.serialNumber}
            verifyToken={passport.verifyToken}
            baseUrl={baseUrl}
          />
        )}
        {activeTab === "scans" && <PassportScansTab scans={scans} />}
        {activeTab === "verification" && (
          <PassportVerificationPanel
            passportId={passport.id}
            initialComplianceStatus={verificationComplianceStatus}
            initialHistory={verificationHistory}
          />
        )}
        {activeTab === "settings" && (
          <PassportLifecycleManagementPanel
            passportId={passport.id}
            currentStatus={currentStatus}
            onStatusChange={(status, action) => {
              setCurrentStatus(status)
              setLifecycleAction(action)
            }}
          />
        )}
      </div>
    </div>
  )
}
