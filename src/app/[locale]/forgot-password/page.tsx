"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { Loader2 } from "lucide-react"
import { toFriendlyAuthError } from "@/lib/auth-errors"
import { authUi } from "@/components/auth/auth-ui"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const supabase = createClient()
      const localeSegment = window.location.pathname.split("/")[1] || "en"
      // Send users directly to the reset page. Supabase appends ?code= (PKCE) or hash tokens;
      // the client exchanges the code / reads the session before showing the new-password form.
      const redirectTo = `${window.location.origin}/${localeSegment}/reset-password`

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetErr) {
        setError(toFriendlyAuthError(resetErr.message))
        return
      }

      setMessage("If an account exists for that email, we sent a reset link. Check your inbox.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex min-h-screen flex-col ${authUi.page}`}>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className={authUi.card}>
          <SimplePageBreadcrumbs
            className="mb-5"
            items={[
              { label: "Home", href: "/" },
              { label: "Forgot password" },
            ]}
          />
          <h1 className={authUi.title}>Reset password</h1>
          <p className={authUi.subtitle}>
            We&apos;ll email you a link to set a new password.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="fp-email" className={authUi.label}>
                Email
              </label>
              <input
                id="fp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authUi.input}
              />
            </div>
            {error && <div className={authUi.alertError}>{error}</div>}
            {message && <div className={authUi.alertInfo}>{message}</div>}
            <button type="submit" disabled={loading} className={authUi.primaryBtn}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
          <p className="mt-8 text-center text-[15px] text-zinc-500">
            <Link href="/login" className={`${authUi.link} text-[15px] no-underline hover:underline`}>
              Sign in
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
