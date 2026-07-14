import type { SupabaseClient } from "@supabase/supabase-js"
import { getRuleConfig } from "./rule-engine"
import type { VerificationFinding, VerificationRule } from "./types"

type DocRow = {
  id: string
  verification_status: "pending" | "verified" | "expired" | "invalid"
  expires_at: string | null
}

export async function evaluateDocumentIntegrity(
  supabase: SupabaseClient,
  productId: string,
  rules: VerificationRule[],
): Promise<VerificationFinding[]> {
  const findings: VerificationFinding[] = []
  const { data } = await supabase
    .from("product_documents")
    .select("id, verification_status, expires_at")
    .eq("product_id", productId)

  const docs = (data ?? []) as DocRow[]
  const missingRule = getRuleConfig(rules, "missing_documents")

  if (!docs.length) {
    findings.push({
      ruleType: "missing_documents",
      severity: missingRule.severity,
      scoreImpact: missingRule.scoreImpact,
      message: "Compliance documents are missing for this product.",
      metadata: { documentCount: 0 },
    })
    return findings
  }

  const now = Date.now()
  const invalidDocs = docs.filter((d) => d.verification_status === "invalid")
  const expiredDocs = docs.filter((d) => {
    if (d.verification_status === "expired") return true
    if (!d.expires_at) return false
    const ts = new Date(d.expires_at).getTime()
    return Number.isFinite(ts) && ts < now
  })

  if (invalidDocs.length || expiredDocs.length) {
    findings.push({
      ruleType: "missing_documents",
      severity: missingRule.severity,
      scoreImpact: missingRule.scoreImpact,
      message: "Document integrity checks found invalid or expired files.",
      metadata: {
        invalidCount: invalidDocs.length,
        expiredCount: expiredDocs.length,
      },
    })
  }

  return findings
}
