"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { Link } from "@/i18n/navigation"
import { Loader2 } from "lucide-react"
import { toFriendlyAuthError } from "@/lib/auth-errors"
import { authUi } from "@/components/auth/auth-ui"

const MIN_LEN = 8

export function UpdatePasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LEN) {
      setError(`Use at least ${MIN_LEN} characters.`)
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("This link is invalid or expired. Request a new reset email.")
        return
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) {
        setError(toFriendlyAuthError(updateErr.message))
        return
      }

      await supabase.auth.signOut()
      router.push("/login?reset=success")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={authUi.card}>
      <h1 className={authUi.title}>New password</h1>
      <p className={authUi.subtitle}>Choose a strong password you haven&apos;t used elsewhere.</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="new-password" className={authUi.label}>
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LEN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authUi.input}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className={authUi.label}>
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LEN}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authUi.input}
          />
        </div>
        {error && <div className={authUi.alertError}>{error}</div>}
        <button type="submit" disabled={loading} className={authUi.primaryBtn}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            "Update password"
          )}
        </button>
      </form>
      <p className="mt-8 text-center text-[15px] text-zinc-500">
        <Link href="/login" className={`${authUi.link} text-[15px] no-underline hover:underline`}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
