"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { Link } from "@/i18n/navigation"
import { Loader2 } from "lucide-react"
import { toFriendlyAuthError } from "@/lib/auth-errors"
import { authUi } from "@/components/auth/auth-ui"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<"info" | "error">("info")
  const [mode, setMode] = useState<"password" | "magic">("password")

  useEffect(() => {
    const reset = searchParams.get("reset")
    const err = searchParams.get("error")
    const reason = searchParams.get("reason")
    if (reset === "success") {
      setMessageTone("info")
      setMessage("Password updated. Sign in with your new password.")
      return
    }
    if (err === "auth_callback" && reason) {
      setMessageTone("error")
      setMessage(decodeURIComponent(reason))
      return
    }
    if (err === "reset_session") {
      setMessageTone("error")
      setMessage(
        "Use the latest link from your password reset email, or request a new reset below."
      )
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setMessageTone("error")
        setMessage("Configuration error. Check environment variables.")
        return
      }

      const supabase = createClient()

      if (mode === "magic") {
        const localeSegment = window.location.pathname.split("/")[1] || "en"
        const redirectUrl = `${window.location.origin}/${localeSegment}/auth/callback?next=/${localeSegment}/dashboard`

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectUrl },
        })

        if (error) {
          setMessageTone("error")
          setMessage(toFriendlyAuthError(error.message))
          return
        }

        setMessageTone("info")
        setMessage("Check your email for the magic link to sign in.")
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessageTone("error")
        setMessage(toFriendlyAuthError(error.message))
        return
      }

      router.push("/dashboard")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={authUi.formInner}>
      <div className="mb-10">
        <h1 className={authUi.title}>Sign in</h1>
        <p className={authUi.subtitle}>
          Password or email link — same workspace, zero friction.
        </p>
      </div>

      <div className={`${authUi.segmentWrap} mb-8`}>
        <button
          type="button"
          onClick={() => {
            setMode("password")
            setMessage(null)
          }}
          className={`${authUi.segmentBtn} ${mode === "password" ? authUi.segmentBtnActive : ""}`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic")
            setMessage(null)
          }}
          className={`${authUi.segmentBtn} ${mode === "magic" ? authUi.segmentBtnActive : ""}`}
        >
          Email link
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className={authUi.label}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={authUi.input}
          />
        </div>

        {mode === "password" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="login-password" className={authUi.label}>
                Password
              </label>
              <Link href="/forgot-password" className={`${authUi.linkMuted} mb-1.5`}>
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={authUi.input}
            />
          </div>
        )}

        {message && (
          <div className={messageTone === "error" ? authUi.alertError : authUi.alertInfo}>
            <p>{message}</p>
            {messageTone === "error" && searchParams.get("error") === "reset_session" && (
              <Link href="/forgot-password" className={`${authUi.link} mt-2 inline-block text-[13px]`}>
                Request new link
              </Link>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className={authUi.primaryBtn}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait…
            </>
          ) : mode === "magic" ? (
            "Continue with email link"
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-10 text-center text-[15px] text-zinc-500">
        No account?{" "}
        <Link href="/signup" className={`${authUi.link} text-[15px] no-underline hover:underline`}>
          Create one
        </Link>
      </p>
    </div>
  )
}
