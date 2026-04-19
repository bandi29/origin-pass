"use client"

import { useRouter, usePathname } from "@/i18n/navigation"
import {
  ScanLine,
  Package,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
} from "lucide-react"
import { KpiCard } from "@/components/analytics/KpiCard"
import { LineChartCard } from "@/components/analytics/LineChartCard"
import { BarChartCard } from "@/components/analytics/BarChartCard"
import { TopCountriesCard } from "@/components/analytics/TopCountriesCard"
import { TopProductsTable } from "@/components/analytics/TopProductsTable"
import { FraudAlertPanel } from "@/components/analytics/FraudAlertPanel"
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters"
import type {
  KpiMetrics,
  ScanOverTimePoint,
  CountryCount,
  FraudDistribution,
  TopProduct,
  OwnershipOverTimePoint,
  FraudAlert,
  DateRangePreset,
} from "@/backend/modules/analytics/dashboard"

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null
  return ((current - prev) / prev) * 100
}

type AnalyticsDashboardClientProps = {
  dateRange: DateRangePreset
  kpis: KpiMetrics
  scansOverTime: ScanOverTimePoint[]
  topCountries: CountryCount[]
  fraudDistribution: FraudDistribution[]
  topProducts: TopProduct[]
  ownershipOverTime: OwnershipOverTimePoint[]
  fraudAlerts: FraudAlert[]
}

export function AnalyticsDashboardClient({
  dateRange,
  kpis,
  scansOverTime,
  topCountries,
  fraudDistribution,
  topProducts,
  ownershipOverTime,
  fraudAlerts,
}: AnalyticsDashboardClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleDateRangeChange = (range: DateRangePreset) => {
    const url = new URL(pathname, "http://x")
    url.searchParams.set("range", range)
    router.push(`${pathname}?range=${range}`)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-2 text-slate-500">
            Insights from scan and ownership data.
          </p>
        </div>
        <AnalyticsFilters dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Total scans"
          value={kpis.totalScans.toLocaleString()}
          changePercent={pctChange(kpis.totalScans, kpis.totalScansPrev)}
          icon={<ScanLine className="h-5 w-5" />}
        />
        <KpiCard
          title="Unique products scanned"
          value={kpis.uniqueProductsScanned.toLocaleString()}
          changePercent={pctChange(kpis.uniqueProductsScanned, kpis.uniqueProductsScannedPrev)}
          icon={<Package className="h-5 w-5" />}
        />
        <KpiCard
          title="Active passports"
          value={kpis.activePassports.toLocaleString()}
          changePercent={null}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <KpiCard
          title="Fraud alerts"
          value={kpis.fraudAlerts.toLocaleString()}
          changePercent={pctChange(kpis.fraudAlerts, kpis.fraudAlertsPrev)}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <KpiCard
          title="Ownership claims"
          value={kpis.ownershipClaims.toLocaleString()}
          changePercent={pctChange(kpis.ownershipClaims, kpis.ownershipClaimsPrev)}
          icon={<UserCheck className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LineChartCard
          title="Scan activity over time"
          data={scansOverTime}
          dataKey="scans"
        />
        <LineChartCard
          title="Ownership growth"
          data={ownershipOverTime}
          dataKey="claims"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarChartCard
          title="Valid vs suspicious scans"
          data={fraudDistribution}
        />
        <TopCountriesCard data={topCountries} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopProductsTable data={topProducts} />
        </div>
        <div>
          <FraudAlertPanel alerts={fraudAlerts} />
        </div>
      </div>
    </div>
  )
}
