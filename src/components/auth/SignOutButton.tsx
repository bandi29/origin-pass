"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2, LogOut } from "lucide-react"

type SignOutButtonProps = {
  className?: string
  children?: React.ReactNode
  redirectTo?: string
}

export function SignOutButton({
  className = "",
  children = "Sign out",
  redirectTo = "/login",
}: SignOutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push(redirectTo)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-[13px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
      )}
      {loading ? "Signing out…" : children}
    </button>
  )
}
