"use client"

import dynamic from "next/dynamic"
import { useRouter, usePathname } from "@/i18n/navigation"
import {
  ScanLine,
  Package,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
} from "lucide-react"
import { StatCard } from "@/components/ui/StatCard"
import { OnboardingEmptyState } from "@/components/ui/OnboardingEmptyState"
import { typography } from "@/design-system/tokens"
import { QR_IDENTITY_LEDGER_STATUS_FILTER, QR_IDENTITY_LOG_DIRECTORY_PATH, QR_IDENTITY_PASSPORT_CREATE_PATH } from "@/lib/qr-identity-nav"
// Recharts is ~150 KB gzipped — lazy-load it so it doesn't ship with the dashboard
// shell. The chart cards each render their own skeleton while the chunk loads.
const LineChartCard = dynamic(
  () => import("@/components/analytics/LineChartCard").then((m) => ({ default: m.LineChartCard })),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" aria-hidden />
    ),
  },
)
const BarChartCard = dynamic(
  () => import("@/components/analytics/BarChartCard").then((m) => ({ default: m.BarChartCard })),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" aria-hidden />
    ),
  },
)
import { TopCountriesCard } from "@/components/analytics/TopCountriesCard"
import { TopProductsTable } from "@/components/analytics/TopProductsTable"
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters"
import type {
  KpiMetrics,
  ScanOverTimePoint,
  CountryCount,
  FraudDistribution,
  TopProduct,
  OwnershipOverTimePoint,
  DateRangePreset,
} from "@/backend/modules/analytics/dashboard"

type AnalyticsDashboardClientProps = {
  dateRange: DateRangePreset
  kpis: KpiMetrics
  scansOverTime: ScanOverTimePoint[]
  topCountries: CountryCount[]
  fraudDistribution: FraudDistribution[]
  topProducts: TopProduct[]
  ownershipOverTime: OwnershipOverTimePoint[]
  /** When true, omit the built-in page title (caller renders PageHeader). */
  hideHeader?: boolean
}

export function AnalyticsDashboardClient({
  dateRange,
  kpis,
  scansOverTime,
  topCountries,
  fraudDistribution,
  topProducts,
  ownershipOverTime,
  hideHeader = false,
}: AnalyticsDashboardClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleDateRangeChange = (range: DateRangePreset) => {
    const url = new URL(pathname, "http://x")
    url.searchParams.set("range", range)
    router.push(`${pathname}?range=${range}`)
  }

  const hasCountryData = topCountries.length > 0
  const hasScanData = kpis.totalScans > 0

  return (
    <div className="space-y-8">
      {hideHeader ? null : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={typography.pageTitle}>Analytics</h1>
            <p className={typography.pageLede}>Insights from scan and ownership data.</p>
          </div>
          <AnalyticsFilters dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        </div>
      )}

      {hideHeader ? (
        <div className="flex justify-end">
          <AnalyticsFilters dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        </div>
      ) : null}

      {!hasScanData ? (
        /* Zero-telemetry onboarding rail: replaces a wall of zeroed KPIs and
           empty chart placeholders with the actual next step. The date-range
           filter above stays mounted so users with older data can widen the
           window. */
        <OnboardingEmptyState
          icon={<ScanLine className="h-6 w-6" />}
          heading="No scan telemetry yet"
          body="Live verification activity, geography, and risk signals appear here once your QR labels are scanned in the field. Start by generating serialized QR identities for your products."
          primaryAction={{
            label: "Create product passport",
            href: QR_IDENTITY_PASSPORT_CREATE_PATH,
          }}
          secondaryAction={{
            label: "View QR identities",
            href: QR_IDENTITY_LOG_DIRECTORY_PATH,
          }}
        />
      ) : (
        <>
          {/* Five-up KPIs via the shared StatCard primitive: clean absolute counts,
              no period-comparison badges. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Total scans"
              icon={<ScanLine />}
              tone="indigo"
              value={kpis.totalScans.toLocaleString()}
              href={QR_IDENTITY_LOG_DIRECTORY_PATH}
            />
            <StatCard
              label="Unique passports scanned"
              labelHint="The total number of individual serialized product items verified."
              icon={<Package />}
              tone="violet"
              value={kpis.uniqueProductsScanned.toLocaleString()}
              href={QR_IDENTITY_LEDGER_STATUS_FILTER.active}
            />
            <StatCard
              label="Active passports"
              icon={<ShieldCheck />}
              tone="emerald"
              value={kpis.activePassports.toLocaleString()}
              href="/dashboard/product-passports"
            />
            <StatCard
              label="Suspicious scans"
              labelHint="Total raw scan events that triggered a high risk score; these are consolidated into actionable cases inside your Verification tab."
              icon={<ShieldAlert />}
              tone="rose"
              value={kpis.fraudAlerts.toLocaleString()}
              href={QR_IDENTITY_LEDGER_STATUS_FILTER.compromised}
            />
            <StatCard
              label="Ownership claims"
              icon={<UserCheck />}
              tone="navy"
              value={kpis.ownershipClaims.toLocaleString()}
              href={QR_IDENTITY_LEDGER_STATUS_FILTER.pending}
            />
          </div>

          {/* Primary scan story side by side: volume trend + verdict breakdown. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <LineChartCard
              title="Scan activity over time"
              data={scansOverTime}
              dataKey="scans"
            />
            <BarChartCard
              title="Valid vs suspicious scans"
              data={fraudDistribution}
            />
          </div>

          {/* Top countries only renders when geo data exists; ownership growth
              expands to full width otherwise so the layout ends without gaps. */}
          <div className={hasCountryData ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
            <LineChartCard
              title="Ownership growth"
              data={ownershipOverTime}
              dataKey="claims"
            />
            {hasCountryData ? <TopCountriesCard data={topCountries} /> : null}
          </div>

          <TopProductsTable data={topProducts} />
        </>
      )}
    </div>
  )
}
