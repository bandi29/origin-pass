/**
 * Dev / web-portal plan stub. Shopify Admin uses `src/lib/shopify-billing.ts`.
 */
export type PlanTier = "free" | "pro-plan" | "scale-plan"

export function getUserPlan(): PlanTier {
  if (process.env.NODE_ENV !== "production") {
    const raw = process.env.NEXT_PUBLIC_DEV_PLAN
    if (raw === "pro-plan" || raw === "scale-plan" || raw === "free") return raw
    if (raw === "pro" || raw === "grower") return "pro-plan"
    if (raw === "enterprise" || raw === "scale") return "scale-plan"
  }
  return "free"
}

export function isFreePlan(): boolean {
  return getUserPlan() === "free"
}
