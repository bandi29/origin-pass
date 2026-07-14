import type { SupabaseClient } from "@supabase/supabase-js"
import type { VerificationRule, VerificationRuleType } from "./types"

const DEFAULT_RULES: VerificationRule[] = [
  {
    id: "default-duplicate-scan",
    ruleType: "duplicate_scan",
    thresholdValue: 2,
    scoreImpact: 20,
    severity: "medium",
    isActive: true,
  },
  {
    id: "default-impossible-travel",
    ruleType: "impossible_travel",
    thresholdValue: 850,
    scoreImpact: 40,
    severity: "high",
    isActive: true,
  },
  {
    id: "default-scan-velocity",
    ruleType: "scan_velocity",
    thresholdValue: 10,
    scoreImpact: 25,
    severity: "high",
    isActive: true,
  },
  {
    id: "default-ownership-break",
    ruleType: "ownership_break",
    thresholdValue: 1,
    scoreImpact: 30,
    severity: "high",
    isActive: true,
  },
  {
    id: "default-geo-mismatch",
    ruleType: "geo_mismatch",
    thresholdValue: 1,
    scoreImpact: 10,
    severity: "medium",
    isActive: true,
  },
  {
    id: "default-invalid-supplier",
    ruleType: "invalid_supplier",
    thresholdValue: 35,
    scoreImpact: 15,
    severity: "medium",
    isActive: true,
  },
  {
    id: "default-missing-documents",
    ruleType: "missing_documents",
    thresholdValue: 1,
    scoreImpact: 18,
    severity: "medium",
    isActive: true,
  },
]

type RuleRow = {
  id: string
  rule_type: VerificationRuleType
  threshold_value: number | null
  score_impact: number | null
  severity: VerificationRule["severity"]
  is_active: boolean | null
}

export async function loadActiveVerificationRules(
  supabase: SupabaseClient,
  organizationId: string | null,
): Promise<VerificationRule[]> {
  if (!organizationId) return DEFAULT_RULES

  const { data, error } = await supabase
    .from("verification_rules")
    .select("id, rule_type, threshold_value, score_impact, severity, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)

  if (error || !data?.length) return DEFAULT_RULES

  return (data as RuleRow[]).map((r) => ({
    id: r.id,
    ruleType: r.rule_type,
    thresholdValue: r.threshold_value,
    scoreImpact: r.score_impact ?? 0,
    severity: r.severity,
    isActive: Boolean(r.is_active),
  }))
}

export function getRuleConfig(
  rules: VerificationRule[],
  ruleType: VerificationRuleType,
): VerificationRule {
  return (
    rules.find((rule) => rule.ruleType === ruleType && rule.isActive) ??
    DEFAULT_RULES.find((rule) => rule.ruleType === ruleType)!
  )
}
