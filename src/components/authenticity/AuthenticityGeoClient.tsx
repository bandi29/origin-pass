"use client"

import { useMemo, useState } from "react"
import type { GeoHeatRow } from "@/lib/authenticity-intelligence"
import { Card } from "@/components/ui/Card"
import { MapPin } from "lucide-react"
import clsx from "clsx"

function intensityBar(intensity: GeoHeatRow["intensity"]) {
  const w =
    intensity === "high" ? "100%" : intensity === "moderate" ? "66%" : "33%"
  const color =
    intensity === "high"
      ? "bg-red-500"
      : intensity === "moderate"
        ? "bg-amber-400"
        : "bg-slate-300"
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
      <div className={clsx("h-full rounded-full transition-all", color)} style={{ width: w }} />
    </div>
  )
}

/** Simple scatter on a slate panel for map feel without Mapbox / Leaflet. */
function MapPlaceholder({
  rows,
  selected,
  onSelect,
}: {
  rows: GeoHeatRow[]
  selected: GeoHeatRow | null
  onSelect: (r: GeoHeatRow) => void
}) {
  /* Normalize lat/long to 0-100% for a pseudo-projected panel */
  const norm = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100
    const y = ((90 - lat) / 180) * 100
    return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) }
  }

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-ds-border bg-gradient-to-b from-slate-100 to-slate-200/90">
      <p className="absolute left-3 top-3 z-10 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-ds-text-muted shadow-sm">
        Activity overlay (simplified)
      </p>
      {rows.map((r) => {
        const { x, y } = norm(r.lat, r.long)
        const size =
          r.intensity === "high" ? 18 : r.intensity === "moderate" ? 14 : 10
        const color =
          r.intensity === "high"
            ? "bg-red-500/90 shadow-red-500/40"
            : r.intensity === "moderate"
              ? "bg-amber-400/90 shadow-amber-400/40"
              : "bg-slate-500/70"
        const sel = selected?.city === r.city && selected?.country === r.country
        return (
          <button
            key={`${r.country}-${r.city}`}
            type="button"
            title={`${r.city}, ${r.country}`}
            className={clsx(
              "absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg ring-2 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50",
              color,
              sel ? "ring-white ring-offset-2 ring-offset-slate-200" : "ring-white/50"
            )}
            style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }}
            onClick={() => onSelect(r)}
            aria-label={`${r.city}, ${r.country}`}
          />
        )
      })}
    </div>
  )
}

export function AuthenticityGeoClient({ rows }: { rows: GeoHeatRow[] }) {
  const [selected, setSelected] = useState<GeoHeatRow | null>(rows[0] ?? null)

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.suspicious_scans - a.suspicious_scans),
    [rows]
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-ds-text-muted">
        Suspicious scan density by region (last 30 days). Click a hotspot for details. Swap in
        Mapbox or Leaflet when ready.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-ds-border bg-white p-8 text-center text-sm text-ds-text-muted shadow-sm">
          No suspicious scans with a known country in the last 30 days.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
            <MapPlaceholder rows={rows} selected={selected} onSelect={setSelected} />
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-ds-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> High
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Moderate
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Low
              </span>
            </div>
          </Card>

          <Card
            padding
            className="h-fit rounded-2xl border border-ds-border bg-[#F9FAFB] shadow-sm"
          >
            <h3 className="text-sm font-semibold text-ds-text">Regional summary</h3>
            {selected ? (
              <div className="mt-4 rounded-2xl border border-ds-border bg-white p-4 shadow-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
                  <div>
                    <p className="font-semibold text-ds-text">
                      {selected.city}, {selected.country}
                    </p>
                    <p className="mt-2 text-sm text-ds-text-muted">
                      Suspicious scans:{" "}
                      <span className="font-medium text-ds-text">
                        {selected.suspicious_scans.toLocaleString()}
                      </span>
                    </p>
                    <p className="text-sm text-ds-text-muted">
                      Affected products:{" "}
                      <span className="font-medium text-ds-text">
                        {selected.affected_products}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ds-border text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                    <th className="pb-3 pr-3">Country</th>
                    <th className="pb-3 pr-3">City</th>
                    <th className="pb-3 pr-3">Scans</th>
                    <th className="pb-3 pr-3">Products</th>
                    <th className="pb-3">Heat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border">
                  {sorted.map((r) => (
                    <tr
                      key={`${r.country}-${r.city}`}
                      className={clsx(
                        "cursor-pointer hover:bg-white/80",
                        selected?.city === r.city && selected?.country === r.country
                          ? "bg-white"
                          : ""
                      )}
                      onClick={() => setSelected(r)}
                    >
                      <td className="py-3 pr-3 text-ds-text">{r.country}</td>
                      <td className="py-3 pr-3 text-ds-text-muted">{r.city}</td>
                      <td className="py-3 pr-3 tabular-nums text-ds-text">
                        {r.suspicious_scans.toLocaleString()}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-ds-text-muted">
                        {r.affected_products}
                      </td>
                      <td className="py-3">{intensityBar(r.intensity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
