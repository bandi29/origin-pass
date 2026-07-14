import type { SupabaseClient } from "@supabase/supabase-js"
import { getRuleConfig } from "./rule-engine"
import type {
  ProductValidationInput,
  VerificationFinding,
  VerificationRule,
} from "./types"

export async function runInitialProductValidation(
  supabase: SupabaseClient,
  input: ProductValidationInput,
  rules: VerificationRule[],
): Promise<VerificationFinding[]> {
  const findings: VerificationFinding[] = []

  if (!input.sku?.trim()) {
    findings.push({
      ruleType: "missing_documents",
      severity: "medium",
      scoreImpact: 5,
      message: "SKU is missing.",
    })
  } else {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("sku", input.sku.trim())
      .neq("id", input.productId)
    if ((count ?? 0) > 0) {
      const rule = getRuleConfig(rules, "duplicate_scan")
      findings.push({
        ruleType: "duplicate_scan",
        severity: rule.severity,
        scoreImpact: rule.scoreImpact,
        message: "Duplicate SKU detected in the tenant catalog.",
      })
    }
  }

  if (input.serialNumber?.trim()) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("serial_number", input.serialNumber.trim())
      .neq("id", input.productId)
    if ((count ?? 0) > 0) {
      findings.push({
        ruleType: "duplicate_scan",
        severity: "high",
        scoreImpact: 25,
        message: "Duplicate serial number detected.",
      })
    }
  }

  if (!input.originCountry?.trim()) {
    findings.push({
      ruleType: "geo_mismatch",
      severity: "medium",
      scoreImpact: 8,
      message: "Origin country is missing.",
    })
  }

  if (!input.supplierId?.trim()) {
    const rule = getRuleConfig(rules, "invalid_supplier")
    findings.push({
      ruleType: "invalid_supplier",
      severity: rule.severity,
      scoreImpact: rule.scoreImpact,
      message: "Supplier reference is missing.",
    })
  }

  if (input.materials?.length) {
    const invalidPct = input.materials.filter((m) => {
      if (typeof m.compositionPercentage !== "number") return true
      return m.compositionPercentage < 0 || m.compositionPercentage > 100
    })
    if (invalidPct.length) {
      findings.push({
        ruleType: "missing_documents",
        severity: "medium",
        scoreImpact: 10,
        message: "One or more material percentages are invalid.",
        metadata: { invalidRows: invalidPct.length },
      })
    }
  }

  return findings
}
