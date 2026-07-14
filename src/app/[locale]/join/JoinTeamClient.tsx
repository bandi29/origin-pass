"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { useToast } from "@/components/ui/Toast"

export function JoinTeamClient() {
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams])
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    if (!token) {
      toast.error("Missing invitation token in the URL.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Could not accept invitation")
        return
      }
      toast.success("You’re in! Redirecting to your dashboard…")
      router.replace("/dashboard")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-16 text-slate-50">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/80 p-8 shadow-2xl ring-1 ring-white/10">
        <h1 className="text-2xl font-semibold tracking-tight">Accept team invitation</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with the email address that received the invite, then confirm below. Invitations expire after seven days.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button type="button" onClick={accept} disabled={busy || !token}>
            {busy ? "Joining…" : "Accept invitation"}
          </Button>
          <Button type="button" variant="outline" className="border-slate-600 text-slate-100" onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </Button>
        </div>
      </Card>
    </main>
  )
}
