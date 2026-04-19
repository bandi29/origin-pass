"use client"

import { useEffect, useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  type CategoryKey,
  type CategorySchema,
  type FieldSection,
  type SchemaField,
} from "@/lib/compliance/category-schemas"
import { ClipboardCheck, FileText, MapPin, ShieldCheck } from "lucide-react"
import { clsx } from "clsx"
import { DatePicker } from "@/components/ui/DatePicker"

const SECTION_ORDER: FieldSection[] = ["basic", "compliance", "traceability", "certifications"]

const SECTION_META: Record<FieldSection, { title: string; icon: typeof ShieldCheck }> = {
  basic: { title: "Basic info", icon: FileText },
  compliance: { title: "Compliance", icon: ShieldCheck },
  traceability: { title: "Traceability", icon: MapPin },
  certifications: { title: "Certifications & evidence", icon: ClipboardCheck },
}

function fieldsForSection(schema: CategorySchema, section: FieldSection) {
  return schema.fields.filter((f) => f.section === section)
}

/** Subtle emerald outline + smooth transition when AI mapped a value into compliance_data */
export const AI_FILLED_OUTLINE =
  "border border-emerald-400/90 ring-2 ring-emerald-200/50 shadow-[0_0_0_1px_rgba(16,185,129,0.08)] transition-[box-shadow,border-color,ring-color] duration-300 ease-out"

type StrategyFieldsProps = {
  categoryKey: CategoryKey
  schema: CategorySchema
  readField: (f: SchemaField) => unknown
  setField: (f: SchemaField, v: unknown) => void
  aiFilledKeys: Set<string>
}

/**
 * Renders Basic / Compliance / Traceability / Certifications blocks from the active category schema.
 * LEATHER shows tanning site + EUDR DDS under Compliance; TEXTILE shows fiber composition + recycled %, etc.
 */
export function ComplianceStrategyFields({
  categoryKey,
  schema,
  readField,
  setField,
  aiFilledKeys,
}: StrategyFieldsProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={categoryKey}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
      >
        {SECTION_ORDER.map((section) => {
          const fields = fieldsForSection(schema, section)
          if (fields.length === 0) return null
          const Meta = SECTION_META[section]
          return (
            <motion.section
              key={`${categoryKey}-${section}`}
              layout
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22 }}
              className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-4"
            >
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Meta.icon className="w-5 h-5 text-slate-400" />
                {Meta.title}
              </h3>
              <div className="space-y-4">
                {fields.map((f) => (
                  <DynamicFieldRenderer
                    key={f.key}
                    field={f}
                    value={readField(f)}
                    onChange={(v) => setField(f, v)}
                    aiAutoFilled={aiFilledKeys.has(f.key)}
                  />
                ))}
              </div>
            </motion.section>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

type FieldProps = {
  field: SchemaField
  value: unknown
  onChange: (v: unknown) => void
  aiAutoFilled?: boolean
}

export function DynamicFieldRenderer({ field, value, onChange, aiAutoFilled }: FieldProps) {
  const label = (
    <span>
      {field.label}
      {field.required ? <span className="text-rose-500"> *</span> : null}
      {field.complianceTags?.length ? (
        <span className="ml-2 text-[10px] font-normal text-slate-400">
          {field.complianceTags.join(" · ")}
        </span>
      ) : null}
    </span>
  )

  const help = field.helpText ? <p className="text-xs text-slate-500 mt-0.5">{field.helpText}</p> : null

  const wrap = (inner: ReactNode) => (
    <div
      className={clsx(
        aiAutoFilled && ["rounded-xl p-0.5", AI_FILLED_OUTLINE],
      )}
    >
      {inner}
    </div>
  )

  if (field.type === "textarea") {
    return wrap(
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
        />
        {help}
      </>,
    )
  }

  if (field.type === "number") {
    return wrap(
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input
          type="number"
          value={value === undefined || value === null || value === "" ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
        />
        {help}
      </>,
    )
  }

  if (field.type === "boolean") {
    return (
      <div
        className={clsx(
          "flex items-start gap-2",
          aiAutoFilled && ["rounded-xl p-2", AI_FILLED_OUTLINE],
        )}
      >
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1"
        />
        <div>
          <span className="text-sm font-medium text-slate-800">{label}</span>
          {help}
        </div>
      </div>
    )
  }

  if (field.type === "geo") {
    return (
      <GeoField
        label={label}
        help={help}
        value={value}
        onChange={onChange}
        aiAutoFilled={aiAutoFilled}
      />
    )
  }

  if (field.type === "select" && field.options?.length) {
    return wrap(
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {help}
      </>,
    )
  }

  if (field.type === "date") {
    return wrap(
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <DatePicker
          value={String(value ?? "")}
          onChange={(iso) => onChange(iso)}
          placeholder="mm/dd/yyyy"
          className="mt-1"
        />
        {help}
      </>,
    )
  }

  if (field.type === "documentUrl" || field.type === "url") {
    return wrap(
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input
          type="url"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
        />
        <p className="text-xs text-slate-500 mt-1">Paste a hosted PDF or document URL.</p>
        {help}
      </>,
    )
  }

  return wrap(
    <>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
      />
      {help}
    </>,
  )
}

function GeoField({
  label,
  help,
  value,
  onChange,
  aiAutoFilled,
}: {
  label: ReactNode
  help: ReactNode
  value: unknown
  onChange: (v: unknown) => void
  aiAutoFilled?: boolean
}) {
  const g = (value as { lat?: number; lng?: number } | null) || {}
  const [latStr, setLatStr] = useState(() => (g.lat != null ? String(g.lat) : ""))
  const [lngStr, setLngStr] = useState(() => (g.lng != null ? String(g.lng) : ""))

  useEffect(() => {
    const gg = (value as { lat?: number; lng?: number } | null) || {}
    /* eslint-disable react-hooks/set-state-in-effect -- sync string fields when parent value changes */
    setLatStr(gg.lat != null ? String(gg.lat) : "")
    setLngStr(gg.lng != null ? String(gg.lng) : "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [value])

  function push(lat: string, lng: string) {
    if (lat.trim() === "" && lng.trim() === "") {
      onChange(null)
      return
    }
    const latN = parseFloat(lat)
    const lngN = parseFloat(lng)
    if (!Number.isNaN(latN) && !Number.isNaN(lngN)) {
      onChange({ lat: latN, lng: lngN })
    }
  }

  return (
    <div
      className={clsx(
        "grid gap-3 sm:grid-cols-2",
        aiAutoFilled && ["rounded-xl p-0.5", AI_FILLED_OUTLINE],
      )}
    >
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        {help}
      </div>
      <div>
        <label className="text-xs text-slate-500">Latitude</label>
        <input
          type="text"
          inputMode="decimal"
          value={latStr}
          onChange={(e) => {
            const t = e.target.value
            setLatStr(t)
            push(t, lngStr)
          }}
          placeholder="e.g. 45.46"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500">Longitude</label>
        <input
          type="text"
          inputMode="decimal"
          value={lngStr}
          onChange={(e) => {
            const t = e.target.value
            setLngStr(t)
            push(latStr, t)
          }}
          placeholder="e.g. 9.19"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <p className="sm:col-span-2 text-xs text-slate-500">
        Paste coordinates from maps. Saved under compliance_data.origin_geo.
      </p>
    </div>
  )
}
