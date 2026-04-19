"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AuthPageShell } from "@/components/auth/AuthPageShell"
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm"
import { Link } from "@/i18n/navigation"
import { Loader2 } from "lucide-react"
import { authUi } from "@/components/auth/auth-ui"

type Phase = "loading" | "ready" | "invalid"

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>("loading")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function establishRecoverySession() {
      const supabase = createClient()

      const errParam = searchParams.get("error_description") || searchParams.get("error")
      if (errParam) {
        const msg =
          typeof errParam === "string"
            ? decodeURIComponent(errParam.replace(/\+/g, " "))
            : "This reset link is invalid or expired."
        if (!cancelled) {
          setStatusMessage(msg)
          setPhase("invalid")
        }
        return
      }

      const code = searchParams.get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          if (!cancelled) {
            setStatusMessage(error.message)
            setPhase("invalid")
          }
          return
        }
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href)
          url.searchParams.delete("code")
          const qs = url.searchParams.toString()
          window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}`)
        }
      }

      const trySession = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        return session
      }

      let session = await trySession()
      if (session) {
        if (!cancelled) setPhase("ready")
        return
      }

      for (let i = 0; i < 15; i++) {
        if (cancelled) return
        await sleep(200)
        session = await trySession()
        if (session) {
          if (!cancelled) setPhase("ready")
          return
        }
      }

      if (!cancelled) {
        setStatusMessage(
          "This reset link is invalid, expired, or was already used. Request a new one below."
        )
        setPhase("invalid")
      }
    }

    void establishRecoverySession()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  if (phase === "loading") {
    return (
      <div className={authUi.formInner}>
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" aria-hidden />
          <div>
            <h1 className={authUi.title}>Verifying your link</h1>
            <p className={`${authUi.subtitle} mt-2`}>
              One moment while we secure your session so you can choose a new password.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "invalid") {
    return (
      <div className={authUi.formInner}>
        <h1 className={authUi.title}>Link expired</h1>
        <p className={`${authUi.subtitle} mt-2`}>
          {statusMessage ||
            "Password reset links only work for a short time and can only be used once."}
        </p>
        <div className="mt-8 space-y-3">
          <Link
            href="/forgot-password"
            className={`${authUi.primaryBtn} inline-flex w-full justify-center no-underline`}
          >
            Email me a new link
          </Link>
          <Link href="/login" className={`${authUi.linkMuted} block text-center text-[15px]`}>
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  return <UpdatePasswordForm />
}

export function ResetPasswordPageClient() {
  return (
    <AuthPageShell
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Sign in", href: "/login" },
        { label: "Reset password" },
      ]}
      marketing={{
        title: "Set a new password in seconds.",
        body:
          "We verify your email link, then you choose a new password. After you save, sign in with the new password.",
        footer: "Recovery links are single-use and time-limited, like other major apps.",
      }}
    >
      <Suspense
        fallback={
          <div className={authUi.formInner}>
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </AuthPageShell>
  )
}
