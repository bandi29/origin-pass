"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/client"
import { Link } from "@/i18n/navigation"
import { Loader2, ShieldCheck, Sparkles } from "lucide-react"
import { toFriendlyAuthError } from "@/lib/auth-errors"
import { completeOrganizationSignup } from "@/actions/complete-organization-signup"
import { authUi } from "@/components/auth/auth-ui"

type Step = 1 | 2

export function SignupForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setError("Configuration error. Check environment variables.")
        return
      }

      const supabase = createClient()
      const localeSegment = window.location.pathname.split("/")[1] || "en"
      const emailRedirect = `${window.location.origin}/${localeSegment}/auth/callback?next=/${localeSegment}/signup/complete`

      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirect,
          data: { signup_flow: "organization" },
        },
      })

      if (signErr) {
        setError(toFriendlyAuthError(signErr.message))
        return
      }

      if (data.session) {
        setStep(2)
        return
      }

      setInfo(
        "We sent a confirmation link. After you verify your email, sign in to finish your organization setup."
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await completeOrganizationSignup(organizationName)
      if (!result.success) {
        setError(result.error)
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
        <div className="mb-6 flex gap-1.5">
          <span
            className={`h-0.5 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-zinc-900" : "bg-zinc-200"}`}
          />
          <span
            className={`h-0.5 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-zinc-900" : "bg-zinc-200"}`}
          />
        </div>
        <h1 className={authUi.title}>
          {step === 1 ? "Create your account" : "Your organization"}
        </h1>
        <p className={authUi.subtitle}>
          {step === 1
            ? "Email and password — then name your workspace."
            : "Shown to customers and used to isolate your data."}
        </p>
      </div>

      {step === 1 && (
        <>
          <ul className="mb-8 flex flex-wrap gap-6 text-[13px] text-zinc-500">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600/90" strokeWidth={1.75} />
              Secure by Supabase Auth
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-500/90" strokeWidth={1.75} />
              Start free
            </li>
          </ul>

          <form onSubmit={handleStep1} className="space-y-5">
            <div>
              <label htmlFor="su-email" className={authUi.label}>
                Email
              </label>
              <input
                id="su-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={authUi.input}
              />
            </div>
            <div>
              <label htmlFor="su-password" className={authUi.label}>
                Password
              </label>
              <input
                id="su-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={authUi.input}
              />
            </div>

            {error && <div className={authUi.alertError}>{error}</div>}
            {info && <div className={authUi.alertInfo}>{info}</div>}

            <button type="submit" disabled={loading} className={authUi.primaryBtn}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait…
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2} className="space-y-5">
          <div>
            <label htmlFor="su-org" className={authUi.label}>
              Brand / organization name
            </label>
            <input
              id="su-org"
              type="text"
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. Acme Atelier"
              className={authUi.input}
            />
          </div>

          {error && <div className={authUi.alertError}>{error}</div>}

          <button type="submit" disabled={loading} className={authUi.primaryBtn}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating workspace…
              </>
            ) : (
              "Create your account"
            )}
          </button>
        </form>
      )}

      <p className="mt-10 text-center text-[15px] text-zinc-500">
        Have an account?{" "}
        <Link href="/login" className={`${authUi.link} text-[15px] no-underline hover:underline`}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
