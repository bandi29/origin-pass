"use client"

import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Package, ShieldCheck, QrCode, BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card } from "@/components/ui/Card"
import { DataTable } from "@/components/ui/DataTable"
import { UpgradeNudge } from "@/components/saas/UpgradeNudge"
import { AnalyticsTeaser } from "@/components/saas/AnalyticsTeaser"
import { FadeIn } from "@/components/layout/FadeIn"

const quickLinks = [
  {
    href: "/dashboard/products",
    icon: Package,
    title: "Products",
    body: "Manage your product catalog",
  },
  {
    href: "/dashboard/authenticity",
    icon: ShieldCheck,
    title: "Authenticity",
    body: "Verification and trust",
  },
  {
    href: "/product/qr-identity",
    icon: QrCode,
    title: "QR identity",
    body: "Passports and QR codes",
  },
  {
    href: "/analytics",
    icon: BarChart3,
    title: "Analytics",
    body: "Insights and reports",
  },
] as const

const activityRows = [
  { id: "1", event: "Passport scanned", region: "EU", when: "2h ago" },
  { id: "2", event: "New product added", region: "—", when: "Yesterday" },
  { id: "3", event: "Batch QR exported", region: "US", when: "3d ago" },
]

export default function DashboardOverviewPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Overview"
        description="Your OriginPass dashboard at a glance."
        actionItems={[
          { label: "View analytics", variant: "outline", href: "/analytics" },
          { label: "+ New product", variant: "primary", href: "/dashboard/products" },
        ]}
      />

      <UpgradeNudge />

      <AnalyticsTeaser />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <Card interactive className="h-full transition-all duration-200 hover:-translate-y-0.5">
              <item.icon className="h-8 w-8 text-ds-text-muted" aria-hidden />
              <h2 className="mt-3 font-semibold text-ds-text">{item.title}</h2>
              <p className="mt-1 text-sm text-ds-text-muted">{item.body}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium text-ds-text">Recent activity</h2>
        <DataTable
          columns={[
            {
              id: "event",
              header: "Event",
              accessor: (r) => r.event,
              sortable: true,
            },
            {
              id: "region",
              header: "Region",
              accessor: (r) => r.region,
              sortable: true,
            },
            {
              id: "when",
              header: "When",
              accessor: (r) => r.when,
              sortable: true,
            },
          ]}
          data={activityRows}
          getRowKey={(r) => r.id}
          pageSize={5}
          emptyTitle="No activity yet"
          emptyDescription="Create a product or publish a passport to see events here."
        />
      </div>
    </FadeIn>
  )
}
