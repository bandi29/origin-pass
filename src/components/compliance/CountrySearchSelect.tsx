"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { getCountryOptions } from "@/lib/location-options"
import clsx from "clsx"

const INPUT_FOCUS =
  "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-50/10 dark:focus:border-slate-50"

type CountrySearchSelectProps = {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  aiAutoFilled?: boolean
}

export function CountrySearchSelect({
  id: idProp,
  value,
  onChange,
  placeholder = "Select country…",
  disabled,
  aiAutoFilled,
}: CountrySearchSelectProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const listId = `${id}-listbox`
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const names = useMemo(() => getCountryOptions().map((c) => c.name), [])

  const [q, setQ] = useState(value)
  useEffect(() => {
    setQ(value)
  }, [value])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return names.slice(0, 40)
    return names.filter((n) => n.toLowerCase().includes(t)).slice(0, 60)
  }, [q, names])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [q, open])

  function pick(name: string) {
    onChange(name)
    setQ(name)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)))
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    }
    if (e.key === "Enter" && filtered[highlight]) {
      e.preventDefault()
      pick(filtered[highlight])
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={q}
        onChange={(e) => {
          const v = e.target.value
          setQ(v)
          onChange(v)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="one-time-code"
        data-lpignore="true"
        className={clsx(
          "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm",
          INPUT_FOCUS,
          aiAutoFilled && "border-emerald-400/90 ring-2 ring-emerald-200/50",
        )}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[9999] mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <li className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Countries
            </span>
            <button
              type="button"
              className="text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:hover:text-slate-200"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">No matching countries</li>
          ) : (
            filtered.map((name, i) => (
              <li key={name} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={clsx(
                    "flex w-full cursor-pointer px-3 py-2 text-left text-sm transition",
                    i === highlight ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/80",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(name)}
                >
                  {name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
