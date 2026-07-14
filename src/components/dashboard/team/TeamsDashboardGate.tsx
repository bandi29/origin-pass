"use client"

import { useEffect, useState } from "react"
import { Link } from "@/i18n/navigation"
import { TeamsManagementClient } from "@/components/dashboard/team/TeamsManagementClient"
import type { TeamDashboardPayload } from "@/lib/team/team-dashboard-data"

const FETCH_MS = 28_000

export function TeamsDashboardGate() {
  const [phase, setPhase] = useState<
    "loading" | "ok" | "no-org" | "schema" | "bootstrap" | "config" | "error"
  >("loading")
  const [payload, setPayload] = useState<TeamDashboardPayload | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    const timeout = window.setTimeout(() => ac.abort(), FETCH_MS)

    ;(async () => {
      try {
        const res = await fetch("/api/team/data", { signal: ac.signal, cache: "no-store" })
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

        if (res.status === 404) {
          setPhase("no-org")
          return
        }
        if (res.status === 503 && json.code === "team_schema_missing") {
          setPhase("schema")
          return
        }
        if (res.status === 503 && json.code === "team_bootstrap_failed") {
          setPhase("bootstrap")
          return
        }
        if (res.status === 503 && json.code === "missing_service_role") {
          setPhase("config")
          return
        }
        if (!res.ok) {
          setPhase("error")
          return
        }
        setPayload(json as TeamDashboardPayload)
        setPhase("ok")
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setPhase("error")
      } finally {
        window.clearTimeout(timeout)
      }
    })()

    return () => {
      window.clearTimeout(timeout)
      ac.abort()
    }
  }, [])

  if (phase === "loading") {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading team workspace">
        <div className="h-40 rounded-3xl bg-slate-200/80" />
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          {["Members", "Invitations", "Roles", "Activity", "Settings"].map((t) => (
            <div key={t} className="h-8 w-24 rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-100" />
        <p className="text-center text-sm text-slate-500">Loading team workspace…</p>
      </div>
    )
  }

  if (phase === "no-org") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <p className="font-medium">Finish organization setup</p>
        <p className="mt-2">
          Your account is not linked to an organization yet. Complete signup to invite teammates and manage roles.
        </p>
        <Link
          href="/signup/complete"
          className="mt-4 inline-flex rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
        >
          Complete organization signup
        </Link>
      </div>
    )
  }

  if (phase === "schema") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-950">
        <p className="font-medium">Team database not ready</p>
        <p className="mt-2 text-rose-900/90">
          This Supabase project does not have the Team tables yet. Apply migration{" "}
          <code className="rounded bg-rose-100 px-1">20260426220000_team_management.sql</code> (creates{" "}
          <code className="rounded bg-rose-100 px-1">team_roles</code>,{" "}
          <code className="rounded bg-rose-100 px-1">organization_members</code>, etc.). Local:{" "}
          <code className="rounded bg-rose-100 px-1">npx supabase db push</code>. Hosted: paste/run the migration in
          the Supabase SQL editor or your deploy pipeline. Ensure{" "}
          <code className="rounded bg-rose-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> is set on the server, then
          refresh.
        </p>
      </div>
    )
  }

  if (phase === "bootstrap") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-950">
        <p className="font-medium">Team membership could not be loaded</p>
        <p className="mt-2 text-rose-900/90">
          Team tables are present, but your account has no usable row in{" "}
          <code className="rounded bg-rose-100 px-1">organization_members</code> (or role data is incomplete). Try
          refreshing once. If it persists, ask an organization owner to confirm you are still in the org, or contact
          support. Developers: check server logs for Supabase errors from{" "}
          <code className="rounded bg-rose-100 px-1">getActorTeamContext</code> /{" "}
          <code className="rounded bg-rose-100 px-1">ensureOrganizationMemberForUser</code>.
        </p>
      </div>
    )
  }

  if (phase === "config") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-950">
        <p className="font-medium">Service role key missing</p>
        <p className="mt-2 text-rose-900/90">
          Add <code className="rounded bg-rose-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> to your environment (e.g.{" "}
          <code className="rounded bg-rose-100 px-1">.env.local</code> or Vercel project settings). It must match the{" "}
          <strong>service_role</strong> secret from Supabase Project Settings → API. Restart the dev server after
          changing env.
        </p>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-950">
        <p className="font-medium">Team data could not be loaded.</p>
        <p className="mt-2 text-rose-900/90">
          Check your connection, apply the latest Supabase migrations (team tables), and confirm{" "}
          <code className="rounded bg-rose-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> is set. Then refresh this page.
        </p>
      </div>
    )
  }

  if (!payload) {
    return null
  }

  return <TeamsManagementClient initial={payload} />
}
