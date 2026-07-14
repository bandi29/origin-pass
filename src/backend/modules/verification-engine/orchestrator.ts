import { createAdminClient } from "@/lib/supabase/admin"
import { applyRiskFindings } from "./risk-engine"
import { loadActiveVerificationRules } from "./rule-engine"
import { evaluateImpossibleTravel } from "./impossible-travel-engine"
import { evaluateDuplicateScanPatterns } from "./duplicate-scan-engine"
import { evaluateOwnershipChain } from "./ownership-chain-engine"
import { evaluateDocumentIntegrity } from "./document-integrity-engine"
import { runInitialProductValidation } from "./validation-engine"
import type {
  ProductValidationInput,
  ScanSignalInput,
  VerificationContext,
  VerificationFinding,
} from "./types"

type OrchestratorInput = {
  product: ProductValidationInput
  currentRiskScore: number
  scanSignal?: ScanSignalInput
}

type OrchestratorResult = {
  findings: VerificationFinding[]
  riskBefore: number
  riskAfter: number
  status: "unverified" | "verified" | "in_review" | "suspicious" | "high_risk"
}

export async function runVerificationOrchestrator(
  ctx: VerificationContext,
  input: OrchestratorInput,
): Promise<OrchestratorResult> {
  const { supabase, organizationId } = ctx
  const rules = await loadActiveVerificationRules(supabase, organizationId)
  const findings: VerificationFinding[] = []

  findings.push(
    ...(await runInitialProductValidation(supabase, input.product, rules)),
  )
  findings.push(
    ...(await evaluateDocumentIntegrity(supabase, input.product.productId, rules)),
  )

  const ownershipFinding = await evaluateOwnershipChain(
    supabase,
    input.product.productId,
    rules,
  )
  if (ownershipFinding) findings.push(ownershipFinding)

  if (input.scanSignal) {
    findings.push(
      ...(await evaluateDuplicateScanPatterns(supabase, input.scanSignal, rules)),
    )
    const impossibleTravel = await evaluateImpossibleTravel(
      supabase,
      input.scanSignal,
      rules,
    )
    if (impossibleTravel) findings.push(impossibleTravel)
  }

  const risk = applyRiskFindings(input.currentRiskScore, findings)
  return { findings, ...risk }
}

export async function persistVerificationOutputs(
  ctx: VerificationContext,
  productId: string,
  result: OrchestratorResult,
) {
  const { supabase, organizationId, actor } = ctx
  if (!result.findings.length) return

  await supabase.from("verification_events").insert(
    result.findings.map((finding) => ({
      product_id: productId,
      organization_id: organizationId,
      event_type: finding.ruleType,
      event_message: finding.message,
      score_change: finding.scoreImpact,
      risk_before: result.riskBefore,
      risk_after: result.riskAfter,
      metadata_json: {
        severity: finding.severity,
        ...finding.metadata,
      },
    })),
  )

  await createAdminClient().from("audit_logs").insert({
    user_id: actor === "system" ? null : actor,
    action: "verification_orchestrator_run",
    resource: "product",
    metadata: {
      product_id: productId,
      findings: result.findings.length,
      risk_before: result.riskBefore,
      risk_after: result.riskAfter,
      status: result.status,
    },
  })
}
