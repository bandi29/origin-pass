"use client"

import { useCallback, useMemo, useState } from "react"
import {
  DEFAULT_RULES,
  formatRuleAction,
  formatRuleType,
  type RuleAction,
  type VerificationRule,
  type VerificationRuleType,
} from "@/lib/authenticity-dashboard-data"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { Pencil, Plus } from "lucide-react"
import clsx from "clsx"

const RULE_TYPES: { value: VerificationRuleType; label: string }[] = [
  { value: "location_based", label: "Location-based" },
  { value: "frequency_based", label: "Frequency-based" },
  { value: "time_based", label: "Time-based" },
]

const ACTIONS: { value: RuleAction; label: string }[] = [
  { value: "flag_suspicious", label: "Flag as suspicious" },
  { value: "block_verification", label: "Block verification" },
  { value: "send_alert", label: "Send alert" },
]

const selectClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary/30"

function nextRuleId(rules: VerificationRule[]): string {
  const n =
    rules.reduce((max, r) => {
      const m = /^r-(\d+)$/.exec(r.rule_id)
      return m ? Math.max(max, Number(m[1])) : max
    }, 0) + 1
  return `r-${n}`
}

export function AuthenticityRulesClient() {
  const [rules, setRules] = useState<VerificationRule[]>(DEFAULT_RULES)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [type, setType] = useState<VerificationRuleType>("location_based")
  const [conditionScans, setConditionScans] = useState("10")
  const [conditionMinutes, setConditionMinutes] = useState("15")
  const [locationMismatch, setLocationMismatch] = useState(true)
  const [action, setAction] = useState<RuleAction>("flag_suspicious")
  const [errors, setErrors] = useState<{ name?: string }>({})

  const openCreate = useCallback(() => {
    setEditingId(null)
    setName("")
    setType("location_based")
    setConditionScans("10")
    setConditionMinutes("15")
    setLocationMismatch(true)
    setAction("flag_suspicious")
    setErrors({})
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((rule: VerificationRule) => {
    setEditingId(rule.rule_id)
    setName(rule.name)
    setType(rule.type)
    setAction(rule.action)
    const scans = rule.conditions.scans
    const mins = rule.conditions.window_minutes
    setConditionScans(typeof scans === "number" ? String(scans) : "10")
    setConditionMinutes(typeof mins === "number" ? String(mins) : "15")
    setLocationMismatch(Boolean(rule.conditions.location_differs))
    setErrors({})
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingId(null)
  }, [])

  const saveRule = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) {
      setErrors({ name: "Rule name is required." })
      return
    }

    const conditions: Record<string, string | number> = {}
    if (type === "frequency_based") {
      conditions.scans = Number(conditionScans) || 0
      conditions.window_minutes = Number(conditionMinutes) || 0
    } else if (type === "location_based") {
      conditions.location_differs = locationMismatch ? 1 : 0
    } else {
      conditions.enforce_window = `${conditionMinutes}m`
    }

    setRules((prev) => {
      if (editingId) {
        return prev.map((r) =>
          r.rule_id === editingId
            ? {
                ...r,
                name: trimmed,
                type,
                action,
                conditions,
                description:
                  type === "frequency_based"
                    ? `If scans > ${conditions.scans} in ${conditions.window_minutes} minutes`
                    : type === "location_based"
                      ? locationMismatch
                        ? "If location differs from origin"
                        : "Location checks (custom)"
                      : `Time window: ${conditionMinutes} minutes`,
              }
            : r
        )
      }
      const newRule: VerificationRule = {
        rule_id: nextRuleId(prev),
        name: trimmed,
        description:
          type === "frequency_based"
            ? `If scans > ${conditions.scans} in ${conditions.window_minutes} minutes`
            : type === "location_based"
              ? locationMismatch
                ? "If location differs from origin"
                : "Location-based rule"
              : `Time-based rule (${conditionMinutes}m)`,
        type,
        conditions,
        action,
        is_active: true,
      }
      return [...prev, newRule]
    })
    closeModal()
  }, [
    action,
    closeModal,
    conditionMinutes,
    conditionScans,
    editingId,
    locationMismatch,
    name,
    type,
  ])

  const toggleRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.rule_id === id ? { ...r, is_active: !r.is_active } : r
      )
    )
  }, [])

  const title = useMemo(
    () => (editingId ? "Edit verification rule" : "Create verification rule"),
    [editingId]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ds-text-muted">
          Toggle rules on or off. Changes apply to new verifications immediately
          (simulated).
        </p>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="shrink-0 shadow-sm"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create rule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <Card
            key={rule.rule_id}
            padding
            className="rounded-2xl border border-ds-border bg-white shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ds-text">
                    {rule.name}
                  </h3>
                  <span
                    className={clsx(
                      "rounded-lg px-2 py-0.5 text-xs font-medium",
                      rule.is_active
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {rule.is_active ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-sm text-ds-text-muted">{rule.description}</p>
                <p className="text-xs text-ds-text-muted">
                  {formatRuleType(rule.type)} · {formatRuleAction(rule.action)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.is_active}
                  onClick={() => toggleRule(rule.rule_id)}
                  className={clsx(
                    "relative h-8 w-14 rounded-full transition-colors",
                    rule.is_active ? "bg-slate-900" : "bg-slate-200"
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
                      rule.is_active ? "left-7" : "left-1"
                    )}
                  />
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!px-3"
                  onClick={() => openEdit(rule)}
                  aria-label={`Edit ${rule.name}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={title}
        description="Define how OriginPass should evaluate scans."
        size="lg"
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="rule-name"
              className="text-xs font-medium uppercase tracking-wide text-ds-text-muted"
            >
              Rule name
            </label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors({})
              }}
              placeholder="e.g. High-frequency scan throttle"
              className="mt-1.5"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="rule-type"
              className="text-xs font-medium uppercase tracking-wide text-ds-text-muted"
            >
              Rule type
            </label>
            <select
              id="rule-type"
              value={type}
              onChange={(e) =>
                setType(e.target.value as VerificationRuleType)
              }
              className={clsx(selectClass, "mt-1.5")}
            >
              {RULE_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-ds-border bg-[#F9FAFB] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
              Conditions
            </p>
            {type === "frequency_based" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-ds-text-muted" htmlFor="scans">
                    If scans greater than
                  </label>
                  <Input
                    id="scans"
                    inputMode="numeric"
                    value={conditionScans}
                    onChange={(e) => setConditionScans(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label
                    className="text-xs text-ds-text-muted"
                    htmlFor="minutes"
                  >
                    In minutes (Y)
                  </label>
                  <Input
                    id="minutes"
                    inputMode="numeric"
                    value={conditionMinutes}
                    onChange={(e) => setConditionMinutes(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : type === "location_based" ? (
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ds-text">
                <input
                  type="checkbox"
                  checked={locationMismatch}
                  onChange={(e) => setLocationMismatch(e.target.checked)}
                  className="rounded border-gray-300"
                />
                If location differs from origin
              </label>
            ) : (
              <div className="mt-3">
                <label
                  className="text-xs text-ds-text-muted"
                  htmlFor="time-win"
                >
                  Validity / window (minutes)
                </label>
                <Input
                  id="time-win"
                  inputMode="numeric"
                  value={conditionMinutes}
                  onChange={(e) => setConditionMinutes(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="rule-action"
              className="text-xs font-medium uppercase tracking-wide text-ds-text-muted"
            >
              Action
            </label>
            <select
              id="rule-action"
              value={action}
              onChange={(e) => setAction(e.target.value as RuleAction)}
              className={clsx(selectClass, "mt-1.5")}
            >
              {ACTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={saveRule}>
              Save rule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
