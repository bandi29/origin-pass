"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

/**
 * Lets a page supply a human label for a path segment the URL can't describe on
 * its own (e.g. a passport UUID → its serial id). The global RouteBreadcrumbs is
 * path-based and has no data access, so pages register an override keyed by the
 * raw segment and the breadcrumb consumes it.
 */
type OverrideMap = Record<string, string>

type BreadcrumbOverrideContextValue = {
  overrides: OverrideMap
  register: (key: string, label: string) => void
  unregister: (key: string) => void
}

const EMPTY: OverrideMap = {}

const BreadcrumbOverrideContext = createContext<BreadcrumbOverrideContextValue | null>(null)

export function BreadcrumbOverrideProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<OverrideMap>({})

  const register = useCallback((key: string, label: string) => {
    setOverrides((prev) => (prev[key] === label ? prev : { ...prev, [key]: label }))
  }, [])

  const unregister = useCallback((key: string) => {
    setOverrides((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  // Stable identity except when `overrides` actually changes — `register`/
  // `unregister` are stable, so consumers (and the register effect) don't thrash.
  const value = useMemo(
    () => ({ overrides, register, unregister }),
    [overrides, register, unregister],
  )

  return (
    <BreadcrumbOverrideContext.Provider value={value}>
      {children}
    </BreadcrumbOverrideContext.Provider>
  )
}

/** Read the current overrides (safe to call without a provider — returns `{}`). */
export function useBreadcrumbOverrides(): OverrideMap {
  return useContext(BreadcrumbOverrideContext)?.overrides ?? EMPTY
}

/** Register `label` for `key` for the lifetime of the calling component. No-ops without a provider. */
export function useRegisterBreadcrumbLabel(
  key: string | null | undefined,
  label: string | null | undefined,
) {
  const ctx = useContext(BreadcrumbOverrideContext)
  // Depend only on the stable register/unregister callbacks — NOT the whole
  // context object, whose identity changes whenever overrides update (which would
  // otherwise re-run this effect on every registration and loop infinitely).
  const register = ctx?.register
  const unregister = ctx?.unregister
  useEffect(() => {
    if (!register || !unregister || !key || !label) return
    register(key, label)
    return () => unregister(key)
  }, [register, unregister, key, label])
}
