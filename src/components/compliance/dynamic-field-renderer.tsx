"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  type CategoryKey,
  type CategorySchema,
  type FieldSection,
  type SchemaField,
} from "@/lib/compliance/category-schemas"
import { ClipboardCheck, FileText, Loader2, MapPin, ShieldAlert, ShieldCheck } from "lucide-react"
import { clsx } from "clsx"
import { DatePicker } from "@/components/ui/DatePicker"
import { CountrySearchSelect } from "@/components/compliance/CountrySearchSelect"

/** Shared focus ring for compliance / premium form controls */
export const COMPLIANCE_INPUT_FOCUS =
  "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-50/10 dark:focus:border-slate-50"

const COMPLIANCE_TAG_BADGE =
  "ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400"

/** Hide raw system tags in production; show polished badges in development. */
function FieldComplianceTags({ tags }: { tags?: string[] }) {
  if (process.env.NODE_ENV === "production" || !tags?.length) return null
  return (
    <>
      {tags.map((tag) => (
        <span key={tag} className={COMPLIANCE_TAG_BADGE}>
          {tag}
        </span>
      ))}
    </>
  )
}

const REACH_ESPR_CHEMICAL_TEMPLATE = `This article is manufactured to align with REACH (EC) No 1907/2006, including Annex XVII restrictions on substances in articles. Declared materials and finishes are selected to avoid harmful levels of chromium VI in leather where relevant, lead in metallic components, and restricted arylamines from azo colorants in textiles where applicable. Supplier declarations and conformity documentation are maintained and available upon request.`

function isCountryOriginField(key: string) {
  return key === "raw_hide_origin_country" || key === "tanning_site_country"
}

function splitComplianceEudrEspr(fields: SchemaField[]) {
  const idx = fields.findIndex((f) => f.key === "chemical_compliance_summary")
  if (idx <= 0) return { eudr: fields, espr: [] as SchemaField[] }
  return { eudr: fields.slice(0, idx), espr: fields.slice(idx) }
}

const SECTION_ORDER: FieldSection[] = ["basic", "compliance", "traceability", "certifications"]

const SECTION_META: Record<FieldSection, { title: string; icon: typeof ShieldCheck }> = {
  basic: { title: "Basic info", icon: FileText },
  compliance: { title: "Compliance", icon: ShieldCheck },
  traceability: { title: "Traceability", icon: MapPin },
  certifications: { title: "Certifications & evidence", icon: ClipboardCheck },
}

/** Deep-link scroll targets from product edit / notifications (`highlight=authenticity` → certifications). */
const SECTION_SCROLL_ID: Partial<Record<FieldSection, string>> = {
  compliance: "wizard-highlight-compliance",
  certifications: "wizard-highlight-authenticity",
}

function fieldsForSection(schema: CategorySchema, section: FieldSection) {
  return schema.fields.filter((f) => f.section === section)
}

/** Subtle emerald outline + smooth transition when AI mapped a value into compliance_data */
export const AI_FILLED_OUTLINE =
  "border border-emerald-400/90 ring-2 ring-emerald-200/50 shadow-[0_0_0_1px_rgba(16,185,129,0.08)] transition-[box-shadow,border-color,ring-color] duration-300 ease-out"

/** Root id for each field — used by passport wizard deep links / focus. */
export function wizardComplianceFieldDomId(fieldKey: string) {
  return `wizard-compliance-field-${fieldKey}`
}

type StrategyFieldsProps = {
  categoryKey: CategoryKey
  schema: CategorySchema
  readField: (f: SchemaField) => unknown
  setField: (f: SchemaField, v: unknown) => void
  aiFilledKeys: Set<string>
  /** Keys of geo fields still missing coordinates after a failed submit (warm border nudge). */
  incompleteGeoFieldKeys?: readonly string[]
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
  incompleteGeoFieldKeys = [],
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
          const isCompliance = section === "compliance"
          const { eudr: eudrFields, espr: esprFields } = isCompliance
            ? splitComplianceEudrEspr(fields)
            : { eudr: fields, espr: [] as SchemaField[] }
          const showEsprDivider = isCompliance && esprFields.length > 0

          return (
            <motion.section
              key={`${categoryKey}-${section}`}
              id={SECTION_SCROLL_ID[section]}
              layout
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22 }}
              className="scroll-mt-24 space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              {isCompliance ? (
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                    <ShieldAlert className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                    Regulatory &amp; Compliance
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    Provide mandatory EUDR deforestation and ESPR chemical tracking data.
                  </p>
                </div>
              ) : (
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                  <Meta.icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  {Meta.title}
                </h3>
              )}
              <div className="space-y-4">
                {eudrFields.map((f) => (
                  <DynamicFieldRenderer
                    key={f.key}
                    field={f}
                    value={readField(f)}
                    onChange={(v) => setField(f, v)}
                    aiAutoFilled={aiFilledKeys.has(f.key)}
                    geoHighlight={f.type === "geo" && incompleteGeoFieldKeys.includes(f.key)}
                  />
                ))}
                {showEsprDivider ? (
                  <div className="my-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {esprFields.map((f) => (
                      <DynamicFieldRenderer
                        key={f.key}
                        field={f}
                        value={readField(f)}
                        onChange={(v) => setField(f, v)}
                        aiAutoFilled={aiFilledKeys.has(f.key)}
                        geoHighlight={f.type === "geo" && incompleteGeoFieldKeys.includes(f.key)}
                      />
                    ))}
                  </div>
                ) : null}
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
  /** Warm amber borders on empty lat/lng when this geo field failed required validation on submit. */
  geoHighlight?: boolean
}

export function DynamicFieldRenderer({ field, value, onChange, aiAutoFilled, geoHighlight }: FieldProps) {
  const label = (
    <span>
      {field.label}
      {field.required ? <span className="text-rose-500"> *</span> : null}
      <FieldComplianceTags tags={field.complianceTags} />
    </span>
  )

  const help = field.helpText ? (
    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{field.helpText}</p>
  ) : null

  const wrap = (inner: ReactNode) => (
    <div
      id={wizardComplianceFieldDomId(field.key)}
      className={clsx(
        "scroll-mt-28",
        aiAutoFilled && ["rounded-xl p-0.5", AI_FILLED_OUTLINE],
      )}
    >
      {inner}
    </div>
  )

  if (field.key === "eudr_dds_reference") {
    return (
      <div
        id={wizardComplianceFieldDomId(field.key)}
        className={clsx("scroll-mt-28", aiAutoFilled && ["rounded-xl p-0.5", AI_FILLED_OUTLINE])}
      >
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
          <span className="inline-flex flex-wrap items-baseline gap-x-1">
            <span>{field.label}</span>
            {field.required ? <span className="text-rose-500"> *</span> : null}
            <FieldComplianceTags tags={field.complianceTags} />
            <span className="ml-1 text-[10px] font-normal italic text-slate-400">(When applicable)</span>
          </span>
        </label>
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., EUDR-DDS-2026-XXXXXX"
          className={clsx(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
            COMPLIANCE_INPUT_FOCUS,
          )}
        />
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          The reference ID issued in the official EU TRACES system.
        </p>
        {help}
      </div>
    )
  }

  if (isCountryOriginField(field.key)) {
    return wrap(
      <>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
        <CountrySearchSelect
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          placeholder={
            field.key === "raw_hide_origin_country"
              ? "Select country of origin..."
              : "Select processing site country..."
          }
          aiAutoFilled={aiAutoFilled}
        />
        {help}
      </>,
    )
  }

  if (field.type === "textarea") {
    const isChemical = field.key === "chemical_compliance_summary"
    const rows = isChemical ? 5 : 3
    const placeholder = isChemical
      ? "e.g., 100% compliant with REACH Annex XVII chemical restrictions. Materials are certified free of harmful chromium, lead, and arylamines."
      : field.placeholder
    return wrap(
      <>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={clsx(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
            COMPLIANCE_INPUT_FOCUS,
          )}
        />
        {isChemical ? (
          <button
            type="button"
            className="mt-1 cursor-pointer text-left text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            onClick={() => {
              const cur = String(value ?? "").trim()
              onChange(cur ? `${cur}\n\n${REACH_ESPR_CHEMICAL_TEMPLATE}` : REACH_ESPR_CHEMICAL_TEMPLATE)
            }}
          >
            Need help? Click to insert a standard REACH/ESPR compliance template
          </button>
        ) : null}
        {help}
      </>,
    )
  }

  if (field.type === "number") {
    return wrap(
      <>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
        <input
          type="number"
          value={value === undefined || value === null || value === "" ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={clsx(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
            COMPLIANCE_INPUT_FOCUS,
          )}
        />
        {help}
      </>,
    )
  }

  if (field.type === "boolean") {
    return (
      <div
        id={wizardComplianceFieldDomId(field.key)}
        className={clsx(
          "scroll-mt-28 flex items-start gap-2",
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
        field={field}
        label={label}
        help={help}
        value={value}
        onChange={onChange}
        aiAutoFilled={aiAutoFilled}
        geoHighlight={geoHighlight}
      />
    )
  }

  if (field.type === "select" && field.options?.length) {
    return wrap(
      <>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
            COMPLIANCE_INPUT_FOCUS,
          )}
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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
        <input
          type="url"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className={clsx(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
            COMPLIANCE_INPUT_FOCUS,
          )}
        />
        <p className="text-xs text-slate-500 mt-1">Paste a hosted PDF or document URL.</p>
        {help}
      </>,
    )
  }

  return wrap(
    <>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={clsx(
          "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
          COMPLIANCE_INPUT_FOCUS,
        )}
      />
      {help}
    </>,
  )
}

/** Allow only digits, one leading minus, and one decimal point per coordinate string. */
function sanitizeCoordInput(raw: string): string {
  let out = ""
  let seenDot = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === "-" && out.length === 0) {
      out += c
      continue
    }
    if (c >= "0" && c <= "9") {
      out += c
      continue
    }
    if (c === "." && !seenDot) {
      out += c
      seenDot = true
    }
  }
  return out
}

type GeoSuggestion = {
  display_name: string
  lat: string
  lon: string
}

function GeoField({
  field,
  label,
  help,
  value,
  onChange,
  aiAutoFilled,
  geoHighlight,
}: {
  field: SchemaField
  label: ReactNode
  help: ReactNode
  value: unknown
  onChange: (v: unknown) => void
  aiAutoFilled?: boolean
  geoHighlight?: boolean
}) {
  const searchCache = useRef<Record<string, GeoSuggestion[]>>({})
  const autofillRegionRef = useRef<HTMLDivElement>(null)
  const autofillInputId = useId()
  const g = (value as { lat?: number; lng?: number } | null) || {}
  const [latStr, setLatStr] = useState(() => (g.lat != null ? String(g.lat) : ""))
  const [lngStr, setLngStr] = useState(() => (g.lng != null ? String(g.lng) : ""))
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    const gg = (value as { lat?: number; lng?: number } | null) || {}
    /* eslint-disable react-hooks/set-state-in-effect -- sync string fields when parent value changes */
    setLatStr(gg.lat != null ? String(gg.lat) : "")
    setLngStr(gg.lng != null ? String(gg.lng) : "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [value])

  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 3) {
      setSuggestions([])
      setShowDropdown(false)
      setIsSearching(false)
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return

        const normalizedQuery = searchQuery.trim().toLowerCase()
        if (normalizedQuery.length < 3) return

        if (Object.hasOwn(searchCache.current, normalizedQuery)) {
          const cached = searchCache.current[normalizedQuery]
          if (!cancelled) {
            setSuggestions(cached)
            setShowDropdown(cached.length > 0)
            setIsSearching(false)
          }
          return
        }

        setIsSearching(true)
        try {
          const res = await fetch(
            `/api/geocode/suggestions?q=${encodeURIComponent(searchQuery.trim())}`,
          )
          const json = (await res.json()) as { suggestions?: GeoSuggestion[] }
          if (cancelled) return
          const list = Array.isArray(json.suggestions) ? json.suggestions : []
          searchCache.current[normalizedQuery] = list
          setSuggestions(list)
          setShowDropdown(list.length > 0)
        } catch {
          if (!cancelled) {
            setSuggestions([])
            setShowDropdown(false)
          }
        } finally {
          if (!cancelled) setIsSearching(false)
        }
      })()
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      setIsSearching(false)
    }
  }, [searchQuery])

  useEffect(() => {
    if (!showDropdown) return
    function onDocMouseDown(e: MouseEvent) {
      if (!autofillRegionRef.current?.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowDropdown(false)
    }
    document.addEventListener("mousedown", onDocMouseDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [showDropdown])

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

  function selectSuggestion(item: GeoSuggestion) {
    setSearchQuery(item.display_name)
    const latS = sanitizeCoordInput(item.lat)
    const lonS = sanitizeCoordInput(item.lon)
    setLatStr(latS)
    setLngStr(lonS)
    push(latS, lonS)
    setShowDropdown(false)
  }

  const showEudrGeoHelper = Boolean(field.eudrGeoRequired)
  const latAmber = Boolean(geoHighlight && latStr.trim() === "")
  const lngAmber = Boolean(geoHighlight && lngStr.trim() === "")

  const inputRing = (amber: boolean) =>
    clsx(
      "w-full rounded-lg border bg-white px-3 py-2 text-sm transition-[border-color,box-shadow] duration-200 dark:bg-slate-950 dark:text-slate-100",
      amber
        ? "border-amber-400/90 ring-2 ring-amber-200/70 dark:border-amber-500/80 dark:ring-amber-900/40"
        : "border-slate-200 dark:border-slate-700",
      !amber && COMPLIANCE_INPUT_FOCUS,
    )

  return (
    <div
      id={wizardComplianceFieldDomId(field.key)}
      className={clsx(
        "scroll-mt-28 grid gap-3 sm:grid-cols-2",
        aiAutoFilled && ["rounded-xl p-0.5", AI_FILLED_OUTLINE],
      )}
    >
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
        {showEudrGeoHelper ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            EUDR compliance requires precise coordinates of the raw material sourcing plot.
          </p>
        ) : null}
        {help}
      </div>

      <div ref={autofillRegionRef} className="relative sm:col-span-2">
        <label htmlFor={autofillInputId} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
          Autofill coordinates
        </label>
        <div className="relative">
          <input
            id={autofillInputId}
            type="text"
            autoComplete="one-time-code"
            data-lpignore="true"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true)
            }}
            placeholder="Start typing a city, region, or address…"
            className={clsx(
              "w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
              COMPLIANCE_INPUT_FOCUS,
            )}
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? `${autofillInputId}-listbox` : undefined}
            aria-autocomplete="list"
          />
          {isSearching ? (
            <Loader2
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500"
              aria-hidden
            />
          ) : null}
        </div>
        {showDropdown && suggestions.length > 0 ? (
          <div
            id={`${autofillInputId}-listbox`}
            role="listbox"
            className="absolute left-0 right-0 z-[9999] mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Location suggestions
              </span>
              <button
                type="button"
                className="text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:hover:text-slate-200"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowDropdown(false)}
              >
                Close
              </button>
            </div>
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat}-${s.lon}-${i}`}
                type="button"
                role="option"
                className="flex w-full flex-col border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-none hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s)}
              >
                <span className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {s.display_name}
                </span>
                <span className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {s.lat}, {s.lon}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Latitude</label>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={latStr}
          onChange={(e) => {
            const t = sanitizeCoordInput(e.target.value)
            setLatStr(t)
            push(t, lngStr)
          }}
          placeholder="e.g., 43.7696"
          className={inputRing(latAmber)}
          aria-invalid={latAmber}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Longitude</label>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={lngStr}
          onChange={(e) => {
            const t = sanitizeCoordInput(e.target.value)
            setLngStr(t)
            push(latStr, t)
          }}
          placeholder="e.g., 11.2558"
          className={inputRing(lngAmber)}
          aria-invalid={lngAmber}
        />
      </div>
      <p className="text-xs text-slate-500 sm:col-span-2 dark:text-slate-400">
        Paste coordinates from maps or use autofill. Saved under{" "}
        <span className="font-mono text-[11px]">compliance_data.{field.key}</span>.
      </p>
    </div>
  )
}
