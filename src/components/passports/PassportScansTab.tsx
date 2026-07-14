import { Activity } from "lucide-react"

type PassportScansTabProps = {
  scans: Array<{
    id: string
    scan_timestamp: string
    location_country: string | null
    location_city: string | null
    device_type: string | null
    scan_result: string
  }>
}

export function PassportScansTab({ scans }: PassportScansTabProps) {
  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
        <div className="rounded-full border border-slate-200 bg-white p-3 text-slate-500">
          <Activity className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Waiting for your first scan
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Once your physical QR identity labels are printed and scanned out in the wild,
          interactive telemetry, geographic signals, and device data maps will automatically
          populate this tab context.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Scan Date
            </th>
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Location
            </th>
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Device
            </th>
            <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {scans.map((scan) => (
            <tr key={scan.id}>
              <td className="py-3 text-sm text-slate-700">
                {new Date(scan.scan_timestamp).toLocaleString()}
              </td>
              <td className="py-3 text-sm text-slate-600">
                {[scan.location_city, scan.location_country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </td>
              <td className="py-3 text-sm text-slate-600">
                {scan.device_type ?? "—"}
              </td>
              <td className="py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    scan.scan_result === "valid"
                      ? "bg-emerald-50 text-emerald-700"
                      : scan.scan_result === "suspicious"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {scan.scan_result}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
