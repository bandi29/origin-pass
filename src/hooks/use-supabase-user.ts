"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[useSupabaseUser] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart the dev server.",
        )
      }
      setLoading(false)
      return
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return
        setUser(data.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
