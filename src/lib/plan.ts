/**
 * Billing / plan — replace with Paddle or DB-backed subscription.
 */
export type PlanTier = "free" | "pro" | "enterprise"

export function getUserPlan(): PlanTier {
  const raw = process.env.NEXT_PUBLIC_DEV_PLAN as PlanTier | undefined
  if (raw === "pro" || raw === "enterprise" || raw === "free") return raw
  return "free"
}

export function isFreePlan(): boolean {
  return getUserPlan() === "free"
}
