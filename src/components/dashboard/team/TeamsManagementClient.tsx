"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import clsx from "clsx"
import { Crown, Mail, MoreHorizontal, Plus, Search, Shield, Sparkles, UserPlus, Users } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { Tabs, type TabItem } from "@/components/ui/Tabs"
import { useToast } from "@/components/ui/Toast"
import type { TeamDashboardPayload } from "@/lib/team/team-dashboard-data"
import { teamHasPermission } from "@/lib/team/team-context"

function formatTs(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  } catch {
    return iso
  }
}

function RoleChip({ slug }: { slug: string }) {
  const styles: Record<string, string> = {
    owner: "bg-violet-50 text-violet-900 ring-1 ring-violet-200/80",
    admin: "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80",
    editor: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80",
    viewer: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
  }
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        styles[slug] ?? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
      )}
    >
      {slug === "owner" ? <Crown className="h-3 w-3" /> : null}
      {slug.replace(/-/g, " ")}
    </span>
  )
}

type Props = {
  initial: TeamDashboardPayload
}

export function TeamsManagementClient({ initial }: Props) {
  const toast = useToast()
  const [data, setData] = useState(initial)
  const [tab, setTab] = useState("members")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRoleSlug, setInviteRoleSlug] = useState("editor")
  const [inviteMessage, setInviteMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [menuRow, setMenuRow] = useState<string | null>(null)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRolePerms, setNewRolePerms] = useState<Record<string, boolean>>({})

  const canManage = teamHasPermission(data.context, "team.manage")
  const canBill = teamHasPermission(data.context, "billing.manage")

  const refetch = useCallback(async () => {
    const res = await fetch("/api/team/data")
    if (!res.ok) return
    const json = (await res.json()) as TeamDashboardPayload
    setData(json)
  }, [])

  const roleOptions = useMemo(() => data.roles.map((r) => ({ value: r.slug, label: r.name })), [data.roles])

  const mergedPeople = useMemo(() => {
    const inv = data.invitations
      .filter((i) => i.status === "pending")
      .map((i) => ({
        key: `inv-${i.id}`,
        kind: "invite" as const,
        name: null as string | null,
        email: i.email,
        roleSlug: i.roleSlug,
        roleName: i.roleName,
        status: "pending_invite" as const,
        last: null as string | null,
        joined: i.createdAt,
        id: i.id,
        userId: null as string | null,
      }))
    const mem = data.members.map((m) => ({
      key: `mem-${m.userId}`,
      kind: "member" as const,
      name: m.name,
      email: m.email,
      roleSlug: m.roleSlug,
      roleName: m.roleName,
      status: m.status === "suspended" ? ("suspended" as const) : ("active" as const),
      last: m.lastSeenAt,
      joined: m.joinedAt,
      id: m.id,
      userId: m.userId,
    }))
    return [...mem, ...inv]
  }, [data.invitations, data.members])

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase()
    return mergedPeople.filter((row) => {
      if (q) {
        const blob = `${row.name ?? ""} ${row.email ?? ""}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      if (roleFilter !== "all" && row.roleSlug !== roleFilter) return false
      if (statusFilter === "active" && row.status !== "active") return false
      if (statusFilter === "suspended" && row.status !== "suspended") return false
      if (statusFilter === "pending" && row.status !== "pending_invite") return false
      return true
    })
  }, [mergedPeople, search, roleFilter, statusFilter])

  const roleSummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of data.members) {
      if (m.status !== "active") continue
      map.set(m.roleSlug, (map.get(m.roleSlug) ?? 0) + 1)
    }
    return [...map.entries()].map(([slug, n]) => ({ slug, n }))
  }, [data.members])

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email required")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          teamRoleSlug: inviteRoleSlug,
          message: inviteMessage.trim() || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Could not send invite")
        return
      }
      if (j.emailWarning) {
        toast.info(`Invitation saved. Email hook: ${j.emailWarning}`)
      } else {
        toast.success("Invitation sent.")
      }
      setInviteOpen(false)
      setInviteEmail("")
      setInviteMessage("")
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (userId: string, teamRoleSlug: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/team/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamRoleSlug }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Update failed")
        return
      }
      toast.success("Role updated")
      setMenuRow(null)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const suspendMember = async (userId: string, suspended: boolean) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/team/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ suspended }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Update failed")
        return
      }
      toast.success(suspended ? "Access suspended" : "Access restored")
      setMenuRow(null)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member from the organization? They will lose dashboard access.")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/team/members/${userId}`, { method: "DELETE" })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Remove failed")
        return
      }
      toast.success("Member removed")
      setMenuRow(null)
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const revokeInvite = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/team/invitations/${id}/revoke`, { method: "POST" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(typeof j.error === "string" ? j.error : "Revoke failed")
        return
      }
      toast.success("Invitation revoked")
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const resendInvite = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/team/invitations/${id}/resend`, { method: "POST" })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Resend failed")
        return
      }
      if (j.token) {
        await navigator.clipboard.writeText(j.acceptUrl ?? "")
        toast.success("New invite link copied to clipboard.")
      } else {
        toast.success("Invitation refreshed")
      }
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const saveOrgSettings = async (partial: { name?: string; logo_url?: string | null }) => {
    setBusy(true)
    try {
      const res = await fetch("/api/team/organization", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(partial),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Save failed")
        return
      }
      toast.success("Saved")
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const createCustomRole = async () => {
    const keys = Object.entries(newRolePerms).filter(([, v]) => v).map(([k]) => k)
    if (!newRoleName.trim() || !keys.length) {
      toast.error("Name and at least one permission required")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/team/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim(), permissionKeys: keys }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Could not create role")
        return
      }
      toast.success("Custom role created")
      setCreateRoleOpen(false)
      setNewRoleName("")
      setNewRolePerms({})
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const groupedCatalog = useMemo(() => {
    const m = new Map<string, typeof data.permissionsCatalog>()
    for (const p of data.permissionsCatalog) {
      const arr = m.get(p.category) ?? []
      arr.push(p)
      m.set(p.category, arr)
    }
    return [...m.entries()]
  }, [data.permissionsCatalog])

  const exportTeamCsv = useCallback(() => {
    const esc = (v: string | null | undefined) => `"${String(v ?? "").replaceAll('"', '""')}"`
    const rows = [
      ["kind", "name", "email", "role", "status", "last_active_at", "joined_or_invited_at"],
      ...mergedPeople.map((row) => [
        row.kind,
        row.name ?? "",
        row.email ?? "",
        row.roleName,
        row.status,
        row.last ?? "",
        row.joined,
      ]),
    ]
    const csv = rows.map((r) => r.map((cell) => esc(cell)).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `team-members-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Team CSV exported")
  }, [mergedPeople, toast])

  useEffect(() => {
    if (!menuRow) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-team-actions-menu='true']")) return
      setMenuRow(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuRow(null)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuRow])

  const membersPanel = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All roles</option>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending invite</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {filteredPeople.length === 0 ? (
        mergedPeople.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 ring-1 ring-slate-200">
              <Users className="h-9 w-9" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">Build your team workspace</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Add teammates to collaborate on authenticity operations, role-based governance, and verification workflows.
            </p>
            {canManage ? (
              <div className="mt-6 flex justify-center">
                <Button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="h-11 gap-2 rounded-xl bg-brand px-6 text-sm font-medium text-white shadow-sm transition duration-200 hover:scale-[1.02] hover:bg-[#08183A] hover:shadow-md"
                >
                  <UserPlus className="h-4 w-4" />
                  Invite your first team member
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="No people match filters"
            description="Try adjusting search or filters to find existing members and invitations."
          />
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPeople.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-100 text-xs font-bold text-slate-700">
                          {(row.name ?? row.email ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{row.name ?? "—"}</div>
                          <div className="text-xs text-slate-500">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleChip slug={row.roleSlug} />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "pending_invite" ? (
                        <Badge className="rounded-lg bg-amber-50 text-amber-900 ring-1 ring-amber-200/80">Pending invite</Badge>
                      ) : row.status === "suspended" ? (
                        <Badge className="rounded-lg bg-rose-50 text-rose-900 ring-1 ring-rose-200/80">Suspended</Badge>
                      ) : (
                        <Badge className="rounded-lg bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.last ? formatTs(row.last) : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatTs(row.joined)}</td>
                    <td className="px-4 py-3 text-right">
                      {canManage ? (
                        <div className="relative inline-block text-left" data-team-actions-menu="true">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            aria-label="Actions"
                            onClick={() => setMenuRow((v) => (v === row.key ? null : row.key))}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {menuRow === row.key ? (
                            <div className="absolute bottom-full right-0 z-50 mb-1 w-52 rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                              {row.kind === "member" && row.userId ? (
                                <>
                                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Change role</div>
                                  {roleOptions.map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                      onClick={() => row.userId && changeRole(row.userId, opt.value)}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                  <div className="my-1 border-t border-slate-100" />
                                  {row.status === "active" ? (
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-50"
                                      onClick={() => row.userId && suspendMember(row.userId, true)}
                                    >
                                      Suspend access
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-sm text-emerald-800 hover:bg-emerald-50"
                                      onClick={() => row.userId && suspendMember(row.userId, false)}
                                    >
                                      Restore access
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm text-rose-800 hover:bg-rose-50"
                                    onClick={() => row.userId && removeMember(row.userId)}
                                  >
                                    Remove member
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                                    onClick={() => resendInvite(row.id)}
                                  >
                                    Resend invite
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                                    onClick={() => revokeInvite(row.id)}
                                  >
                                    Revoke invite
                                  </button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {filteredPeople.map((row) => (
              <div key={row.key} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{row.name ?? "Invitation"}</div>
                    <div className="text-sm text-slate-500">{row.email}</div>
                  </div>
                  <RoleChip slug={row.roleSlug} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{row.status === "pending_invite" ? "Pending invite" : row.status}</span>
                  <span>·</span>
                  <span>Joined {formatTs(row.joined)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const invitationsPanel = (
    <div className="space-y-4">
      {data.invitations.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-7 w-7" />}
          title="No invitations"
          description="Pending and historical invitations appear here."
          action={canManage ? { label: "Invite member", onClick: () => setInviteOpen(true) } : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.invitations.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">{i.email}</td>
                  <td className="px-4 py-3">
                    <RoleChip slug={i.roleSlug} />
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{i.status}</td>
                  <td className="px-4 py-3 text-slate-600">{formatTs(i.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && i.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => resendInvite(i.id)}>
                          Resend
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => revokeInvite(i.id)}>
                          Revoke
                        </Button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const rolesPanel = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">System roles are protected. Create custom roles for specialized access.</p>
        {canManage ? (
          <Button type="button" variant="outline" className="gap-2" onClick={() => setCreateRoleOpen(true)}>
            <Plus className="h-4 w-4" />
            Custom role
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.roles.map((r) => (
          <Card key={r.id} className="border-slate-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{r.name}</h3>
                  {r.isSystem ? (
                    <Badge className="rounded-md bg-slate-100 text-slate-700">System</Badge>
                  ) : (
                    <Badge className="rounded-md bg-indigo-50 text-indigo-800">Custom</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{r.description ?? "—"}</p>
                <p className="mt-2 text-xs font-medium text-slate-600">{r.memberCount} members</p>
              </div>
              <RoleChip slug={r.slug} />
            </div>
            <p className="mt-3 line-clamp-3 text-xs text-slate-500">
              {(r.permissionKeys ?? []).slice(0, 8).join(" · ")}
              {(r.permissionKeys?.length ?? 0) > 8 ? " · …" : ""}
            </p>
            {canManage ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const name = prompt("Name for duplicated role?", `${r.name} copy`)
                    if (!name?.trim()) return
                    setBusy(true)
                    try {
                      const res = await fetch(`/api/team/roles/${r.id}/duplicate`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ name: name.trim() }),
                      })
                      const j = await res.json().catch(() => ({}))
                      if (!res.ok) toast.error(typeof j.error === "string" ? j.error : "Duplicate failed")
                      else {
                        toast.success("Role duplicated")
                        await refetch()
                      }
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Duplicate
                </Button>
                {!r.isSystem ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-rose-700"
                    onClick={async () => {
                      if (!confirm("Delete this custom role?")) return
                      setBusy(true)
                      try {
                        const res = await fetch(`/api/team/roles/${r.id}`, { method: "DELETE" })
                        const j = await res.json().catch(() => ({}))
                        if (!res.ok) toast.error(typeof j.error === "string" ? j.error : "Delete failed")
                        else {
                          toast.success("Role deleted")
                          await refetch()
                        }
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  )

  const activityPanel = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {data.activity.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Activity will appear as your team collaborates.</div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.activity.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{a.actorName ?? "System"}</div>
                  <div className="text-xs text-slate-500">{a.actorEmail ?? ""}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{a.action.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {a.targetType ?? "—"} {a.targetId ? <span className="font-mono">({String(a.targetId).slice(0, 8)}…)</span> : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.ipAddress ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatTs(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  const settingsPanel = (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Organization profile</h3>
        <p className="mt-1 text-xs text-slate-500">Shown across invitations and internal surfaces.</p>
        <OrgProfileForm
          busy={busy}
          initialName={data.organization.name}
          initialLogo={data.organization.logo_url}
          onSave={(v) => saveOrgSettings(v)}
        />
      </Card>
      <Card className="border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Security & session</h3>
        <p className="mt-1 text-xs text-slate-500">Enterprise controls (SSO, SCIM) can extend this model without schema churn.</p>
        <SecuritySettingsForm
          busy={busy}
          initial={data.organization.settings}
          onSave={async (settings) => {
            setBusy(true)
            try {
              const res = await fetch("/api/team/organization", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ settings }),
              })
              const j = await res.json().catch(() => ({}))
              if (!res.ok) toast.error(typeof j.error === "string" ? j.error : "Save failed")
              else {
                toast.success("Security preferences saved")
                await refetch()
              }
            } finally {
              setBusy(false)
            }
          }}
        />
      </Card>
    </div>
  )

  const tabs: TabItem[] = [
    { id: "members", label: "Members", content: membersPanel },
    { id: "invitations", label: "Invitations", content: invitationsPanel },
    { id: "roles", label: "Roles", content: rolesPanel },
    { id: "activity", label: "Activity", content: activityPanel },
    { id: "settings", label: "Settings", content: settingsPanel },
  ]

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100 ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5" />
              Team workspace
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{data.organization.name}</h1>
            <div className="flex flex-wrap gap-2 text-sm text-slate-200/90">
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium ring-1 ring-white/10">
                Plan: {data.organization.subscription_plan ?? "Standard"}
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium ring-1 ring-white/10">
                {data.activeMemberCount} members
              </span>
              <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium ring-1 ring-white/10">
                {data.pendingInviteCount} active invites
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {roleSummary.map((r) => (
                <span key={r.slug} className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium text-slate-100 ring-1 ring-white/10">
                  {r.slug}: {r.n}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row lg:flex-row lg:items-start">
            {canManage ? (
              <Button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="h-10 gap-2 rounded-xl border-0 bg-brand px-4 text-sm font-medium text-white shadow-sm transition duration-200 hover:scale-[1.02] hover:bg-[#08183A] hover:shadow-md"
              >
                <UserPlus className="h-4 w-4" />
                Invite members
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-white/30 bg-transparent px-4 text-sm font-medium text-white transition hover:bg-white/10"
              onClick={exportTeamCsv}
            >
              <Mail className="mr-2 h-4 w-4" />
              Export Team CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-white/30 bg-transparent px-4 text-sm font-medium text-white transition hover:bg-white/10"
              onClick={() => {
                setTab("roles")
              }}
            >
              <Shield className="mr-2 h-4 w-4" />
              Manage roles
            </Button>
            {canBill ? (
              <Link
                href="/dashboard/organization/billing"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/30 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Upgrade plan
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onValueChange={setTab} />

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite teammate" description="They must sign in with this email to accept." size="md">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" placeholder="name@company.com" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={inviteRoleSlug}
              onChange={(e) => setInviteRoleSlug(e.target.value)}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message (optional)</label>
            <textarea
              className="mt-1 min-h-[88px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Add context for their first login…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={sendInvite} disabled={busy}>
              Send invite
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={createRoleOpen} onClose={() => setCreateRoleOpen(false)} title="Create custom role" size="lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role name</label>
            <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="mt-1" placeholder="e.g. Field auditor" />
          </div>
          <div className="space-y-4">
            {groupedCatalog.map(([cat, perms]) => (
              <div key={cat}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{cat}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {perms.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!!newRolePerms[p.key]}
                        onChange={(e) => setNewRolePerms((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                      />
                      <span>
                        <span className="font-medium text-slate-900">{p.key}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" onClick={() => setCreateRoleOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={createCustomRole} disabled={busy}>
              Create role
            </Button>
          </div>
        </div>
      </Modal>

      {busy ? <div className="fixed bottom-4 right-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">Working…</div> : null}
    </div>
  )
}

function OrgProfileForm({
  initialName,
  initialLogo,
  busy,
  onSave,
}: {
  initialName: string
  initialLogo: string | null
  busy: boolean
  onSave: (v: { name?: string; logo_url?: string | null }) => void
}) {
  const [name, setName] = useState(initialName)
  const [logo, setLogo] = useState(initialLogo ?? "")
  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-500">Team name</label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">Logo URL</label>
        <Input className="mt-1" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…" />
      </div>
      <Button type="button" size="sm" disabled={busy} onClick={() => onSave({ name, logo_url: logo.trim() || null })}>
        Save profile
      </Button>
    </div>
  )
}

function SecuritySettingsForm({
  initial,
  busy,
  onSave,
}: {
  initial: Record<string, unknown>
  busy: boolean
  onSave: (s: Record<string, unknown>) => void
}) {
  const [require2fa, setRequire2fa] = useState(Boolean(initial.require2fa))
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(
    typeof initial.sessionTimeoutMinutes === "number" ? initial.sessionTimeoutMinutes : 480,
  )
  const [inviteRestrictions, setInviteRestrictions] = useState(
    (initial.inviteRestrictions as string) === "domain_allowlist" ? "domain_allowlist" : "any_email",
  )
  return (
    <div className="mt-4 space-y-4 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={require2fa} onChange={(e) => setRequire2fa(e.target.checked)} />
        Require two-factor authentication (enforced when your IdP supports it)
      </label>
      <div>
        <label className="text-xs font-semibold text-slate-500">Session timeout (minutes)</label>
        <Input
          className="mt-1 max-w-xs"
          type="number"
          min={5}
          max={10080}
          value={sessionTimeoutMinutes}
          onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value) || 480)}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">Invitations</label>
        <select
          className="mt-1 h-10 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 text-sm"
          value={inviteRestrictions}
          onChange={(e) => setInviteRestrictions(e.target.value)}
        >
          <option value="any_email">Any verified email</option>
          <option value="domain_allowlist">Allowed domains only (configure in SSO phase)</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">SSO, SCIM, and IP allowlists are future-ready via `organizations.settings` without migrations.</p>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() =>
          onSave({
            require2fa,
            sessionTimeoutMinutes,
            inviteRestrictions,
          })
        }
      >
        Save security preferences
      </Button>
    </div>
  )
}
