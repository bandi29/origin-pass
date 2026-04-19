"use client"

/* eslint-disable react-hooks/set-state-in-effect -- draft/calendar/error state sync with controlled ISO value */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import clsx from "clsx"

const PLACEHOLDER_MM = "mm/dd/yyyy"
const AUDIT_RANGE_ERROR =
  "Date must be within the last 10 years for audit validity."
const FORMAT_ERROR_MM = "Enter a valid date as mm/dd/yyyy."

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

/** Local date → YYYY-MM-DD (no TZ shift) */
function toISODateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseISODate(s: string): Date | null {
  const t = s.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const [y, m, d] = t.split("-").map(Number)
  const dt = new Date(y!, m! - 1, d!)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m! - 1 ||
    dt.getDate() !== d
  ) {
    return null
  }
  return dt
}

/** Strict mm/dd/yyyy → local Date */
function parseMMDDYYYY(s: string): Date | null {
  const t = s.trim()
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null
  }
  return dt
}

function parseDateInput(raw: string): Date | null {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return parseISODate(t)
  return parseMMDDYYYY(t)
}

/** Digits only, max 8 → MM/DD/YYYY with slashes */
function formatDigitsToMasked(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

function formatIsoToMMDDYYYY(iso: string): string {
  const d = parseISODate(iso)
  if (!d) return ""
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth()
}

function clampDate(d: Date, min: Date, max: Date): Date {
  const t = startOfDay(d).getTime()
  const tMin = startOfDay(min).getTime()
  const tMax = startOfDay(max).getTime()
  if (t < tMin) return new Date(tMin)
  if (t > tMax) return new Date(tMax)
  return startOfDay(d)
}

function isDateInRange(d: Date, min: Date, max: Date): boolean {
  const t = startOfDay(d).getTime()
  return t >= startOfDay(min).getTime() && t <= startOfDay(max).getTime()
}

function calendarCells(visibleMonth: Date): Date[] {
  const y = visibleMonth.getFullYear()
  const m = visibleMonth.getMonth()
  const first = new Date(y, m, 1)
  const start = new Date(first)
  start.setDate(start.getDate() - start.getDay())
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push(d)
  }
  return cells
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

type DatePickerProps = {
  id?: string
  value: string
  onChange: (isoDate: string) => void
  placeholder?: string
  className?: string
  "aria-labelledby"?: string
  disabled?: boolean
}

/**
 * Audit date field: min = 10 years ago, max = today.
 * mm/dd/yyyy display + masked typing; ISO string in/out for form state; calendar stays in sync.
 */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = PLACEHOLDER_MM,
  className,
  "aria-labelledby": ariaLabelledBy,
  disabled = false,
}: DatePickerProps) {
  const genId = useId()
  const inputId = id ?? `date-picker-${genId}`
  const errorId = `${inputId}-error`
  const listboxId = `${inputId}-calendar`
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [draft, setDraft] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  /** Immediate selected cell highlight before parent re-renders */
  const [pendingIso, setPendingIso] = useState<string | null>(null)

  const maxDate = useMemo(() => startOfDay(new Date()), [])
  const minDate = useMemo(() => {
    const d = new Date(maxDate)
    d.setFullYear(d.getFullYear() - 10)
    return startOfDay(d)
  }, [maxDate])

  const selected = useMemo(() => (value ? parseDateInput(value) : null), [value])

  const selectedInRange = useMemo(() => {
    if (!selected) return true
    return isDateInRange(selected, minDate, maxDate)
  }, [selected, minDate, maxDate])

  useEffect(() => {
    const v = value?.trim() ?? ""
    if (!v) {
      setErrorMessage(null)
      return
    }
    if (!selected) {
      setErrorMessage(FORMAT_ERROR_MM)
      return
    }
    setErrorMessage(null)
  }, [value, selected])

  useEffect(() => {
    if (pendingIso != null && value === pendingIso) {
      setPendingIso(null)
    }
  }, [value, pendingIso])

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base =
      selected && selectedInRange ? selected : maxDate
    const clamped = clampDate(base, minDate, maxDate)
    return new Date(clamped.getFullYear(), clamped.getMonth(), 1)
  })

  const [highlighted, setHighlighted] = useState<Date>(() => {
    const base =
      selected && selectedInRange ? selected : maxDate
    return clampDate(base, minDate, maxDate)
  })

  const today = startOfDay(new Date())

  useEffect(() => {
    if (!open) return
    const base =
      selected && selectedInRange ? selected : maxDate
    const next = clampDate(base, minDate, maxDate)
    setHighlighted(next)
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    const id = requestAnimationFrame(() => {
      panelRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [open, selected, selectedInRange, minDate, maxDate])

  const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)

  const canGoPrev = monthKey(visibleMonth) > monthKey(minMonth)
  const canGoNext = monthKey(visibleMonth) < monthKey(maxMonth)

  const prevYearMonth = new Date(
    visibleMonth.getFullYear() - 1,
    visibleMonth.getMonth(),
    1
  )
  const nextYearMonth = new Date(
    visibleMonth.getFullYear() + 1,
    visibleMonth.getMonth(),
    1
  )
  const canGoPrevYear = monthKey(prevYearMonth) >= monthKey(minMonth)
  const canGoNextYear = monthKey(nextYearMonth) <= monthKey(maxMonth)

  const cells = useMemo(() => calendarCells(visibleMonth), [visibleMonth])

  const displayText = useMemo(() => {
    if (!value) return ""
    return formatIsoToMMDDYYYY(value) || value.trim()
  }, [value])

  useEffect(() => {
    if (!inputFocused) {
      setDraft(value ? formatIsoToMMDDYYYY(value) || value.trim() : "")
    }
  }, [value, inputFocused])

  /** Keep calendar month/highlight aligned when value updates (typing or parent). */
  useEffect(() => {
    const max = startOfDay(new Date())
    const minD = new Date(max)
    minD.setFullYear(minD.getFullYear() - 10)
    const min = startOfDay(minD)
    const d = value ? parseDateInput(value) : null
    if (d && isDateInRange(d, min, max)) {
      const day = startOfDay(d)
      setHighlighted(day)
      setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1))
    }
  }, [value])

  const focusTrigger = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const applyValidIso = useCallback(
    (iso: string) => {
      onChange(iso)
      setErrorMessage(null)
    },
    [onChange]
  )

  const selectDate = useCallback(
    (d: Date) => {
      const day = startOfDay(d)
      if (!isDateInRange(day, minDate, maxDate)) return
      const iso = toISODateString(day)
      setPendingIso(iso)
      applyValidIso(iso)
      setDraft(iso)
      setHighlighted(day)
      setOpen(false)
      focusTrigger()
    },
    [minDate, maxDate, applyValidIso, focusTrigger]
  )

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        focusTrigger()
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open, focusTrigger])

  const moveHighlight = useCallback(
    (deltaDays: number) => {
      setHighlighted((prev) => {
        const n = new Date(prev)
        n.setDate(n.getDate() + deltaDays)
        const clamped = clampDate(n, minDate, maxDate)
        setVisibleMonth(new Date(clamped.getFullYear(), clamped.getMonth(), 1))
        return clamped
      })
    },
    [minDate, maxDate]
  )

  const validateAndCommitDraft = useCallback(() => {
    const raw = draft.trim()
    const previousIso = value?.trim() ?? ""
    const previousDisplay = previousIso
      ? formatIsoToMMDDYYYY(previousIso) || previousIso
      : ""
    if (!raw) {
      setPendingIso(null)
      applyValidIso("")
      setDraft("")
      setErrorMessage(null)
      return
    }
    const parsed = parseDateInput(raw)
    if (!parsed) {
      setErrorMessage(FORMAT_ERROR_MM)
      setDraft(previousDisplay)
      return
    }
    if (!isDateInRange(parsed, minDate, maxDate)) {
      setErrorMessage(AUDIT_RANGE_ERROR)
      setPendingIso(null)
      return
    }
    const iso = toISODateString(parsed)
    setPendingIso(iso)
    applyValidIso(iso)
    setDraft(formatIsoToMMDDYYYY(iso))
    setErrorMessage(null)
  }, [draft, minDate, maxDate, applyValidIso, value])

  const onKeyDownTrigger = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onKeyDownPanel = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        setOpen(false)
        focusTrigger()
        break
      case "ArrowLeft":
        e.preventDefault()
        moveHighlight(-1)
        break
      case "ArrowRight":
        e.preventDefault()
        moveHighlight(1)
        break
      case "ArrowUp":
        e.preventDefault()
        moveHighlight(-7)
        break
      case "ArrowDown":
        e.preventDefault()
        moveHighlight(7)
        break
      case "Enter":
      case " ":
        e.preventDefault()
        if (isDateInRange(highlighted, minDate, maxDate)) {
          selectDate(highlighted)
        }
        break
      default:
        break
    }
  }

  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(visibleMonth)

  const goPrevMonth = () => {
    if (!canGoPrev) return
    setVisibleMonth((vm) => new Date(vm.getFullYear(), vm.getMonth() - 1, 1))
  }
  const goNextMonth = () => {
    if (!canGoNext) return
    setVisibleMonth((vm) => new Date(vm.getFullYear(), vm.getMonth() + 1, 1))
  }
  const goPrevYear = () => {
    if (!canGoPrevYear) return
    setVisibleMonth((vm) => new Date(vm.getFullYear() - 1, vm.getMonth(), 1))
  }
  const goNextYear = () => {
    if (!canGoNextYear) return
    setVisibleMonth((vm) => new Date(vm.getFullYear() + 1, vm.getMonth(), 1))
  }

  const vm = visibleMonth.getMonth()

  const inputValue = inputFocused ? draft : displayText

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <div className="relative flex gap-1">
        <button
          type="button"
          disabled={disabled}
          aria-label="Open calendar"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          className={clsx(
            "absolute left-0 top-1/2 z-[1] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
            disabled && "pointer-events-none opacity-50"
          )}
          onClick={(e) => {
            e.preventDefault()
            if (!disabled) setOpen((o) => !o)
          }}
        >
          <CalendarIcon className="h-4 w-4" aria-hidden />
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? listboxId : undefined}
          aria-labelledby={ariaLabelledBy}
          aria-invalid={errorMessage != null}
          aria-describedby={errorMessage != null ? errorId : undefined}
          aria-autocomplete="none"
          disabled={disabled}
          inputMode="numeric"
          placeholder={placeholder}
          autoComplete="off"
          value={inputValue}
          onChange={(e) => {
            const incoming = e.target.value
            const t = incoming.trim()
            let masked: string
            if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
              const dIso = parseISODate(t)
              masked = dIso ? formatIsoToMMDDYYYY(t) : formatDigitsToMasked(incoming.replace(/\D/g, ""))
            } else {
              const digits = incoming.replace(/\D/g, "").slice(0, 8)
              masked = formatDigitsToMasked(digits)
            }
            setDraft(masked)
            setErrorMessage(null)
            if (masked.length === 10) {
              const parsed = parseMMDDYYYY(masked)
              if (!parsed) {
                setErrorMessage(FORMAT_ERROR_MM)
                return
              }
              if (!isDateInRange(parsed, minDate, maxDate)) {
                setErrorMessage(AUDIT_RANGE_ERROR)
                return
              }
              const iso = toISODateString(parsed)
              setPendingIso(iso)
              applyValidIso(iso)
              const day = startOfDay(parsed)
              setHighlighted(day)
              setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1))
              setErrorMessage(null)
            }
          }}
          onFocus={() => {
            setInputFocused(true)
            setDraft(value ? formatIsoToMMDDYYYY(value) || value.trim() : "")
          }}
          onBlur={() => {
            setInputFocused(false)
            validateAndCommitDraft()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              validateAndCommitDraft()
              return
            }
            onKeyDownTrigger(e)
          }}
          className={clsx(
            "w-full rounded-xl border bg-white py-2 pl-10 pr-3 text-sm text-slate-900 shadow-sm transition-all duration-200",
            errorMessage != null
              ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200"
              : "border-gray-200 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/25",
            "placeholder:text-slate-400 focus:outline-none",
            disabled && "cursor-not-allowed opacity-50"
          )}
        />
      </div>

      {errorMessage ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            id={listboxId}
            role="dialog"
            aria-label="Choose date"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute left-0 top-full z-50 mt-1.5 w-[min(100%,300px)] min-w-[280px] origin-top rounded-2xl border border-slate-200/90 bg-white p-3 shadow-lg shadow-slate-900/10 outline-none"
            onKeyDown={onKeyDownPanel}
            tabIndex={0}
          >
            <div className="mb-2 flex min-h-[2.25rem] items-center gap-2 px-0.5">
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={!canGoPrevYear}
                  title="Previous Year"
                  aria-label="Previous year"
                  onClick={goPrevYear}
                  className={clsx(
                    "rounded-lg p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                    canGoPrevYear
                      ? "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      : "cursor-not-allowed opacity-50"
                  )}
                >
                  <ChevronsLeft
                    className="h-3 w-3 stroke-[1.2] text-slate-400"
                    aria-hidden
                  />
                </button>
                <button
                  type="button"
                  disabled={!canGoPrev}
                  title="Previous month"
                  aria-label="Previous month"
                  onClick={goPrevMonth}
                  className={clsx(
                    "rounded-lg p-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                    canGoPrev
                      ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      : "cursor-not-allowed text-slate-300"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <span className="flex min-h-[2.25rem] min-w-0 flex-1 items-center justify-center px-1 text-center text-sm font-semibold leading-tight text-slate-900 tabular-nums">
                {monthLabel}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={!canGoNext}
                  title="Next month"
                  aria-label="Next month"
                  onClick={goNextMonth}
                  className={clsx(
                    "rounded-lg p-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                    canGoNext
                      ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      : "cursor-not-allowed text-slate-300"
                  )}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={!canGoNextYear}
                  title="Next Year"
                  aria-label="Next year"
                  onClick={goNextYear}
                  className={clsx(
                    "rounded-lg p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                    canGoNextYear
                      ? "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      : "cursor-not-allowed opacity-50"
                  )}
                >
                  <ChevronsRight
                    className="h-3 w-3 stroke-[1.2] text-slate-400"
                    aria-hidden
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div
              className="mt-0.5 grid grid-cols-7 gap-0.5"
              role="grid"
              aria-label="Calendar dates"
            >
              {cells.map((d) => {
                const inMonth = d.getMonth() === vm
                const inRange = isDateInRange(d, minDate, maxDate)
                const isToday = isSameDay(d, today)
                const isoD = toISODateString(startOfDay(d))
                const isSelected =
                  pendingIso === isoD ||
                  (pendingIso == null &&
                    selected != null &&
                    selectedInRange &&
                    isSameDay(d, selected))
                const isHighlighted = isSameDay(d, highlighted)
                const showFocusRing = inRange && isHighlighted && !isSelected
                const showTodayRing =
                  inRange && isToday && !isSelected && !showFocusRing

                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    role="gridcell"
                    tabIndex={-1}
                    aria-disabled={!inRange}
                    aria-selected={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    disabled={!inRange}
                    onMouseEnter={() => inRange && setHighlighted(startOfDay(d))}
                    onClick={() => inRange && selectDate(d)}
                    className={clsx(
                      "relative flex h-9 items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                      !inRange && "pointer-events-none text-gray-300",
                      inRange &&
                        !isSelected &&
                        inMonth &&
                        "text-slate-800 hover:bg-slate-100",
                      inRange && !inMonth && !isSelected && "text-slate-300 hover:bg-slate-50",
                      isSelected &&
                        "bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-600",
                      showFocusRing && "z-[1] ring-2 ring-emerald-500 ring-offset-1",
                      showTodayRing && "ring-2 ring-emerald-400/90",
                      inRange && isToday && !isSelected && "font-medium"
                    )}
                  >
                    <span>{d.getDate()}</span>
                    {inRange && isToday && !isSelected ? (
                      <span
                        className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={!isDateInRange(today, minDate, maxDate)}
                onClick={() => selectDate(today)}
              >
                Today
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
