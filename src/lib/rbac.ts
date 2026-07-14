import type { SupabaseClient } from "@supabase/supabase-js"

export type OriginPassRole =
  | "super_admin"
  | "tenant_admin"
  | "fraud_analyst"
  | "compliance_manager"
  | "supplier"
  | "viewer"

const ROLE_ORDER: OriginPassRole[] = [
  "viewer",
  "supplier",
  "compliance_manager",
  "fraud_analyst",
  "tenant_admin",
  "super_admin",
]

const INVESTIGATION_PRIVILEGED_ROLES: OriginPassRole[] = [
  "super_admin",
  "tenant_admin",
  "fraud_analyst",
  "compliance_manager",
]

export function canResolveCounterfeitAlerts(role: OriginPassRole): boolean {
  return INVESTIGATION_PRIVILEGED_ROLES.includes(role)
}

export function canManageCounterfeitInvestigations(role: OriginPassRole): boolean {
  return INVESTIGATION_PRIVILEGED_ROLES.includes(role)
}

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<OriginPassRole> {
  const { data } = await supabase
    .from("users")
    .select("role_v2, role")
    .eq("id", userId)
    .maybeSingle()

  const candidate = (data?.role_v2 ?? data?.role ?? "viewer") as string
  if (ROLE_ORDER.includes(candidate as OriginPassRole)) {
    return candidate as OriginPassRole
  }
  return "viewer"
}

export function roleGte(role: OriginPassRole, minimum: OriginPassRole): boolean {
  return ROLE_ORDER.indexOf(role) >= ROLE_ORDER.indexOf(minimum)
}
