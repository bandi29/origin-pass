"use client"

import { ChevronDown, Plus, ShieldAlert, Trash2 } from "lucide-react"
import type { GpsrData } from "@/lib/passport-wizard-schemas"

type Props = {
  value: GpsrData
  onChange: (next: GpsrData) => void
  inputClass: string
  cardClass: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GpsrComplianceSection({
  value,
  onChange,
  inputClass,
  cardClass,
  open,
  onOpenChange,
}: Props) {
  const person = value.euResponsiblePerson ?? {}
  const ids = value.productIdentifiers ?? {}
  const warnings = value.safetyInformation ?? []

  function patchPerson(patch: Partial<NonNullable<GpsrData["euResponsiblePerson"]>>) {
    onChange({
      ...value,
      euResponsiblePerson: { ...person, ...patch },
    })
  }

  function patchIds(patch: Partial<NonNullable<GpsrData["productIdentifiers"]>>) {
    onChange({
      ...value,
      productIdentifiers: { ...ids, ...patch },
    })
  }

  return (
    <div className={cardClass}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">GPSR &amp; Safety Compliance</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              EU responsible person, hazard warnings, and product identifiers (optional but
              recommended for EU sales).
            </p>
          </div>
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-5 space-y-6 border-t border-slate-100 pt-5">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              EU responsible person
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
                <input
                  className={inputClass}
                  value={person.name ?? ""}
                  onChange={(e) => patchPerson({ name: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Company</label>
                <input
                  className={inputClass}
                  value={person.company ?? ""}
                  onChange={(e) => patchPerson({ company: e.target.value })}
                  placeholder="Legal entity in the EU"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={person.email ?? ""}
                  onChange={(e) => patchPerson({ email: e.target.value })}
                  placeholder="compliance@brand.eu"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                <input
                  className={inputClass}
                  value={person.phone ?? ""}
                  onChange={(e) => patchPerson({ phone: e.target.value })}
                  placeholder="+33 …"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600">Address</label>
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  value={person.address ?? ""}
                  onChange={(e) => patchPerson({ address: e.target.value })}
                  placeholder="Street, city, postal code, country"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Safety information / hazard warnings
              </h4>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                onClick={() =>
                  onChange({
                    ...value,
                    safetyInformation: [...warnings, ""],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add warning
              </button>
            </div>
            {warnings.length === 0 ? (
              <p className="text-xs text-slate-500">
                No warnings yet. Add choking hazards, flammability notes, age grading, etc.
              </p>
            ) : (
              <div className="space-y-2">
                {warnings.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={inputClass}
                      value={line}
                      onChange={(e) => {
                        const next = [...warnings]
                        next[i] = e.target.value
                        onChange({ ...value, safetyInformation: next })
                      }}
                      placeholder="e.g. Not suitable for children under 3 years"
                    />
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 p-2 text-slate-400 hover:bg-white hover:text-rose-600"
                      aria-label="Remove warning"
                      onClick={() =>
                        onChange({
                          ...value,
                          safetyInformation: warnings.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Product identifiers
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">GTIN</label>
                <input
                  className={inputClass}
                  value={ids.gtin ?? ""}
                  onChange={(e) => patchIds({ gtin: e.target.value })}
                  placeholder="14-digit GTIN"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">HS code</label>
                <input
                  className={inputClass}
                  value={ids.hsCode ?? ""}
                  onChange={(e) => patchIds({ hsCode: e.target.value })}
                  placeholder="e.g. 4202.21"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Batch number</label>
                <input
                  className={inputClass}
                  value={ids.batchNumber ?? ""}
                  onChange={(e) => patchIds({ batchNumber: e.target.value })}
                  placeholder="Lot / batch ID"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
