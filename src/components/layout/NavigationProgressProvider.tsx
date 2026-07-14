"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { usePathname, useSearchParams } from "next/navigation"
import clsx from "clsx"

const NavigationProgressContext = createContext<{
  beginRouteTransition: () => void
}>({
  beginRouteTransition: () => {},
})

export function useNavigationRouteProgress() {
  return useContext(NavigationProgressContext)
}

/** Thin top bar (nprogress-style) for dashboard route changes. */
export function NavigationProgressProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [active, setActive] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams?.toString() ?? ""
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setActive(false)
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current)
      fallbackRef.current = null
    }
  }, [pathname, searchKey])

  const beginRouteTransition = useCallback(() => {
    setActive(true)
    if (fallbackRef.current) clearTimeout(fallbackRef.current)
    fallbackRef.current = setTimeout(() => {
      setActive(false)
      fallbackRef.current = null
    }, 10_000)
  }, [])

  return (
    <NavigationProgressContext.Provider value={{ beginRouteTransition }}>
      {children}
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-slate-900/5 transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="nav-route-progress-bar h-full w-[42%] max-w-xl bg-gradient-to-r from-indigo-500 via-slate-900 to-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.45)]" />
      </div>
    </NavigationProgressContext.Provider>
  )
}
