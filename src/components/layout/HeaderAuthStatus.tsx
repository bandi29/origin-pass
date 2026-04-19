"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { Link } from "@/i18n/navigation"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

function getInitials(user?: User | null) {
  const name = user?.user_metadata?.full_name || user?.email || ""
  const parts = String(name).split(/[@\s]+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function HeaderAuthStatus() {
  const { user, loading } = useSupabaseUser()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const initials = useMemo(() => getInitials(user), [user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return
      setOpen(false)
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push("/login")
  }

  if (loading) {
    return (
      <div
        className="inline-flex h-7 min-w-[5.5rem] animate-pulse rounded-full bg-slate-100"
        aria-hidden
      />
    )
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:text-slate-900 hover:border-slate-300 transition"
      >
        Sign in
      </Link>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-slate-300 transition"
        title={user.email || "Signed in"}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
          {initials}
        </span>
        <span className="hidden sm:inline text-slate-700">Account</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-900">
              {user?.user_metadata?.full_name || "Your Account"}
            </div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <div className="py-1 text-sm">
            <Link
              href="/dashboard"
              className="block cursor-pointer px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Edit Profile
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full cursor-pointer text-left px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
