"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"

type ProtectedRouteProps = {
  children: React.ReactNode
  /** Where to send unauthenticated users */
  loginHref?: string
}

/**
 * Client-side guard for interactive flows. Prefer server layout redirects for real protection.
 */
export function ProtectedRoute({ children, loginHref = "/login" }: ProtectedRouteProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let supabase: ReturnType<typeof createClient>
      try {
        supabase = createClient()
      } catch {
        if (!cancelled) router.replace(loginHref)
        return
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) {
          router.replace(loginHref)
          return
        }
        setReady(true)
      } catch {
        if (cancelled) return
        router.replace(loginHref)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, loginHref])

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Checking session…
      </div>
    )
  }

  return <>{children}</>
}
