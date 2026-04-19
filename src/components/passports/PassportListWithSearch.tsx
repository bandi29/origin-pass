"use client"

import { useState, useMemo, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import { PassportTable } from "./PassportTable"
import type { PassportRow } from "@/lib/passports-data"

type PassportListWithSearchProps = {
  passports: PassportRow[]
  baseUrl: string
  actions?: ReactNode
}

/**
 * Time complexity guarantees:
 * - Exact match (full uid/serial): O(1) via Map lookup
 * - Partial match: O(n) single pass, no nested loops
 * - Index build: O(n) once when passports change
 * - Map.get/set: O(1)
 */
type PassportIndex = Map<string, PassportRow>

/**
 * Build O(1) lookup indices for exact match. Built once when passports change.
 * Lookup by uid or serial = O(1).
 */
function buildExactMatchIndices(
  passports: PassportRow[]
): { byUid: PassportIndex; bySerial: PassportIndex } {
  const byUid = new Map<string, PassportRow>()
  const bySerial = new Map<string, PassportRow>()
  for (let i = 0; i < passports.length; i++) {
    const p = passports[i]
    const uid = (p.passport_uid ?? "").toLowerCase()
    const serial = (p.serial_number ?? "").toLowerCase()
    if (uid) byUid.set(uid, p)
    if (serial) bySerial.set(serial, p)
  }
  return { byUid, bySerial }
}

/**
 * O(1): normalize for flexible match - lowercase, alphanumeric only.
 */
function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s\-_\.]/g, "").replace(/[^a-z0-9]/g, "")
}

/**
 * O(1) per passport: check if passport matches query. No nested loops.
 */
function passportMatchesQuery(
  p: PassportRow,
  trimmed: string,
  trimmedLower: string,
  normalizedQuery: string,
  tokens: string[]
): boolean {
  const uid = p.passport_uid ?? ""
  const serial = p.serial_number ?? ""
  const product = (p.product_name ?? "").toLowerCase()

  if (
    uid.toLowerCase().includes(trimmedLower) ||
    serial.toLowerCase().includes(trimmedLower) ||
    product.includes(trimmedLower)
  ) {
    return true
  }
  const uidNorm = normalizeForMatch(uid)
  const serialNorm = normalizeForMatch(serial)
  if (uidNorm.includes(normalizedQuery) || serialNorm.includes(normalizedQuery)) {
    return true
  }
  if (tokens.length > 1) {
    const searchable = `${uid} ${serial} ${product}`.toLowerCase()
    for (let i = 0; i < tokens.length; i++) {
      if (!searchable.includes(tokens[i])) return false
    }
    return true
  }
  return false
}

/**
 * Filter passports. O(1) for exact match (Map lookup), O(n) single pass for partial.
 */
function filterPassports(
  passports: PassportRow[],
  query: string,
  indices: { byUid: PassportIndex; bySerial: PassportIndex }
): PassportRow[] {
  const trimmed = query.trim()
  if (!trimmed) return passports

  const trimmedLower = trimmed.toLowerCase()

  // O(1) exact match via Map lookup
  const exactByUid = indices.byUid.get(trimmedLower)
  if (exactByUid) return [exactByUid]
  const exactBySerial = indices.bySerial.get(trimmedLower)
  if (exactBySerial) return [exactBySerial]

  // O(n) single pass for partial match - optimal, no nested loops
  const normalizedQuery = normalizeForMatch(trimmed)
  const tokens = trimmedLower.split(/\s+/).filter(Boolean)
  const result: PassportRow[] = []
  for (let i = 0; i < passports.length; i++) {
    const p = passports[i]
    if (passportMatchesQuery(p, trimmed, trimmedLower, normalizedQuery, tokens)) {
      result.push(p)
    }
  }
  return result
}

export function PassportListWithSearch({
  passports,
  baseUrl,
  actions,
}: PassportListWithSearchProps) {
  const [query, setQuery] = useState("")

  const indices = useMemo(() => buildExactMatchIndices(passports), [passports])

  const filtered = useMemo(
    () => filterPassports(passports, query, indices),
    [passports, query, indices]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by passport ID, serial, or product..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
            aria-label="Search passports"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {query && (
          <span className="text-sm text-slate-500 sm:flex-shrink-0">
            {filtered.length} of {passports.length} passport
            {passports.length !== 1 ? "s" : ""}
          </span>
        )}
        {actions}
      </div>

      <PassportTable
        passports={filtered}
        baseUrl={baseUrl}
        emptyMessage={query.trim() ? "no-results" : "none"}
      />
    </div>
  )
}
