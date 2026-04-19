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
      <div className="py-12 text-center">
        <p className="text-slate-500">No scans yet.</p>
        <p className="mt-1 text-sm text-slate-400">
          Scan activity will appear here when customers verify this passport.
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
