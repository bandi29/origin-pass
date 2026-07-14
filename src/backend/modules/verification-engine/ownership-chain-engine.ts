import type { SupabaseClient } from "@supabase/supabase-js"
import { getRuleConfig } from "./rule-engine"
import type { VerificationFinding, VerificationRule } from "./types"

const OWNER_ORDER = ["manufacturer", "distributor", "retailer", "customer"] as const

type ChainRow = {
  owner_type: (typeof OWNER_ORDER)[number]
  transferred_at: string
  transfer_from: string | null
  transfer_to: string | null
}

export async function evaluateOwnershipChain(
  supabase: SupabaseClient,
  productId: string,
  rules: VerificationRule[],
): Promise<VerificationFinding | null> {
  const { data } = await supabase
    .from("ownership_chain")
    .select("owner_type, transferred_at, transfer_from, transfer_to")
    .eq("product_id", productId)
    .order("transferred_at", { ascending: true })

  const rows = (data ?? []) as ChainRow[]
  if (rows.length <= 1) return null

  let broken = false
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]
    const cur = rows[i]
    const prevIdx = OWNER_ORDER.indexOf(prev.owner_type)
    const curIdx = OWNER_ORDER.indexOf(cur.owner_type)
    if (curIdx < prevIdx) {
      broken = true
      break
    }
  }

  if (!broken) return null
  const rule = getRuleConfig(rules, "ownership_break")
  return {
    ruleType: "ownership_break",
    severity: rule.severity,
    scoreImpact: rule.scoreImpact,
    message: "Ownership transfer chain is out of expected order.",
    metadata: {
      chainLength: rows.length,
      ownerTypes: rows.map((r) => r.owner_type),
    },
  }
}
