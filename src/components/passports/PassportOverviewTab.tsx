import { PassportStatusBadge } from "./PassportStatusBadge"
import { EsprReadinessScorecard } from "./EsprReadinessScorecard"
import type { EsprComplianceResult } from "@/lib/complianceScore"

type PassportOverviewTabProps = {
  passport: {
    passportUid: string
    productId: string
    productName?: string
    serialNumber: string
    status: string
    createdAt: string
  }
  esprScore?: EsprComplianceResult | null
}

export function PassportOverviewTab({ passport, esprScore }: PassportOverviewTabProps) {
  return (
    <div className="space-y-6">
      {esprScore ? <EsprReadinessScorecard result={esprScore} /> : null}

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Passport ID
          </dt>
          <dd className="mt-1 font-mono text-sm text-slate-900">{passport.passportUid}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Product</dt>
          <dd className="mt-1 text-sm text-slate-900">{passport.productName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Serial Number
          </dt>
          <dd className="mt-1 font-mono text-sm text-slate-900">{passport.serialNumber}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Status</dt>
          <dd className="mt-1">
            <PassportStatusBadge status={passport.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Creation Date
          </dt>
          <dd className="mt-1 text-sm text-slate-900">
            {passport.createdAt ? new Date(passport.createdAt).toLocaleString() : "—"}
          </dd>
        </div>
      </dl>
    </div>
  )
}
