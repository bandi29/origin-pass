import { Link } from "@/i18n/navigation"
import { ExternalLink, Download, Eye } from "lucide-react"
import { PassportStatusBadge } from "./PassportStatusBadge"
import type { PassportRow } from "@/lib/passports-data"

type PassportTableProps = {
  passports: PassportRow[]
  baseUrl: string
  emptyMessage?: "none" | "no-results"
}

export function PassportTable({
  passports,
  baseUrl,
  emptyMessage = "none",
}: PassportTableProps) {
  if (passports.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        {emptyMessage === "no-results" ? (
          <>
            <p className="text-slate-500">No passports match your search.</p>
            <p className="mt-1 text-sm text-slate-400">
              Try a different passport ID, serial number, or product name.
            </p>
          </>
        ) : (
          <>
            <p className="text-slate-500">No passports yet.</p>
            <p className="mt-1 text-sm text-slate-400">
              Create your first passport to get started.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full">
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Passport ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Product
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Serial Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Scans
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {passports.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/50 transition">
              <td className="px-6 py-4">
                <code className="text-sm font-mono text-slate-900">
                  {p.passport_uid.slice(0, 12)}…
                </code>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {p.product_name ?? "—"}
              </td>
              <td className="px-6 py-4">
                <code className="text-sm font-mono text-slate-700">
                  {p.serial_number}
                </code>
              </td>
              <td className="px-6 py-4">
                <PassportStatusBadge status={p.status} />
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {p.scan_count ?? 0}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {p.created_at
                  ? new Date(p.created_at).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/product/passports/${p.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                  <a
                    href={`${baseUrl}/verify/${p.passport_uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Verify
                  </a>
                  <Link
                    href={`/product/passports/${p.id}?tab=qr`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    QR
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
