"use client"

import { useState } from "react"
import {
  LayoutGrid,
  QrCode,
  Activity,
  ShieldCheck,
  Settings,
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { PassportStatusBadge } from "./PassportStatusBadge"
import { PassportOverviewTab } from "./PassportOverviewTab"
import { PassportQRTab } from "./PassportQRTab"
import { PassportScansTab } from "./PassportScansTab"

type TabId = "overview" | "qr" | "scans" | "verification" | "settings"

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "qr", label: "QR Code", icon: QrCode },
  { id: "scans", label: "Scan Activity", icon: Activity },
  { id: "verification", label: "Verification Status", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
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
}

export function PassportDetailView({
  passport,
  scans,
  defaultTab = "overview",
  baseUrl,
}: PassportDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === defaultTab) ? (defaultTab as TabId) : "overview"
  )

  const verifyHref = `${baseUrl}/verify/${passport.passportUid}`

  return (
    <div className="space-y-8">
      <PageHeader
        title="Passport details"
        description={
          <span className="inline-flex flex-wrap items-center gap-2 text-slate-600">
            <code className="text-sm font-mono text-slate-800">{passport.serialNumber}</code>
            <PassportStatusBadge status={passport.status} />
          </span>
        }
        contextBadge={
          passport.productName ? `Product: ${passport.productName}` : undefined
        }
        actions={
          <a
            href={verifyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            View verification page
          </a>
        }
      />

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {activeTab === "overview" && (
          <PassportOverviewTab passport={passport} />
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
          <div className="space-y-4">
            <p className="text-slate-600">
              Current status: <PassportStatusBadge status={passport.status} />
            </p>
            <p className="text-sm text-slate-500">
              Verification history and manual override coming soon.
            </p>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="space-y-4">
            <p className="text-slate-600">
              Deactivate, revoke, or flag this passport.
            </p>
            <p className="text-sm text-slate-500">
              Status management coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
