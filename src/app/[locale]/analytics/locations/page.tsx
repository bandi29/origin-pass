import { spacing } from "@/design-system/tokens"
import { MapPin } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

export default function AnalyticsLocationsPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Geographic insights"
        description="Geographic distribution of scans."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <MapPin className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Locations</h2>
            <p className="text-sm text-slate-500">
              Where your products are being scanned by country and region.
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
