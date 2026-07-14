import { createServerSupabaseClient } from "@/lib/supabase"

export type ComplianceResult = { ok: boolean; reason?: string; skipped?: boolean }

type OrgRow = {
  id: string
  shop_domain: string | null
  shopify_install_status: string | null
  shopify_redacted_at: string | null
  subscription_tier: string | null
}

async function resolveShopifyOrg(shop: string, shopId: number | null): Promise<OrgRow | null> {
  const supabase = createServerSupabaseClient()

  const { data: byDomain } = await supabase
    .from("organizations")
    .select("id, shop_domain, shopify_install_status, shopify_redacted_at, subscription_tier")
    .eq("shop_domain", shop)
    .maybeSingle()

  if (byDomain) return byDomain as OrgRow

  if (shopId == null) return null

  const { data: byShopId } = await supabase
    .from("organizations")
    .select("id, shop_domain, shopify_install_status, shopify_redacted_at, subscription_tier")
    .eq("shopify_shop_id", shopId)
    .maybeSingle()

  return (byShopId as OrgRow | null) ?? null
}

/**
 * app/uninstalled — revoke token, mark store inactive. Idempotent.
 * Skips token wipe in non-production (Shopify CLI replays on every dev start).
 */
export async function handleShopifyAppUninstalled(
  shop: string,
  shopId: number | null,
): Promise<ComplianceResult> {
  if (process.env.NODE_ENV !== "production") {
    return { ok: true, skipped: true, reason: "non_production" }
  }

  const supabase = createServerSupabaseClient()
  const now = new Date().toISOString()

  const update: Record<string, unknown> = {
    shopify_access_token: null,
    shopify_refresh_token: null,
    shopify_token_expires_at: null,
    shopify_install_status: "uninstalled",
    shopify_uninstalled_at: now,
  }
  if (shopId != null) update.shopify_shop_id = shopId

  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("shop_domain", shop)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[shopify/compliance] app/uninstalled update failed:", error.message)
    return { ok: false, reason: "update_failed" }
  }

  if (!data) {
    console.warn("[shopify/compliance] app/uninstalled: no organization for shop", shop)
    return { ok: true, reason: "store_not_found" }
  }

  console.info("[shopify/compliance] app/uninstalled processed for shop", shop)
  return { ok: true }
}

/**
 * shop/redact (GDPR) — final purge 48h after uninstall. Idempotent.
 * OriginPass does not persist Shopify customer PII; this removes merchant store data.
 */
export async function handleShopifyShopRedact(
  shop: string,
  shopId: number | null,
): Promise<ComplianceResult> {
  const org = await resolveShopifyOrg(shop, shopId)
  if (!org) {
    console.warn("[shopify/compliance] shop/redact: no organization for shop", shop)
    return { ok: true, reason: "store_not_found" }
  }

  if (org.shopify_install_status === "redacted" && org.shopify_redacted_at) {
    return { ok: true, skipped: true, reason: "already_redacted" }
  }

  const supabase = createServerSupabaseClient()
  const orgId = org.id
  const shopDomain = org.shop_domain ?? shop
  const now = new Date().toISOString()

  // Archive synced catalog rows (preserve audit trail without active merchant profile).
  await supabase
    .from("products")
    .update({ is_archived: true })
    .eq("organization_id", orgId)
    .eq("external_source", "shopify")

  // Remove verification evidence from DB + storage.
  const { data: certificates } = await supabase
    .from("certificates")
    .select("file_path")
    .eq("store_id", orgId)

  const filePaths = (certificates ?? [])
    .map((row) => (row as { file_path?: string }).file_path)
    .filter((path): path is string => Boolean(path))

  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("supplier-certificates")
      .remove(filePaths)
    if (storageError) {
      console.error("[shopify/compliance] shop/redact storage purge failed:", storageError.message)
    }
  }

  await supabase.from("certificates").delete().eq("store_id", orgId)

  // Anonymize org row; release shop_domain for potential future reinstall.
  // Billing state resets too — a redacted store must not retain a paid tier.
  const orgUpdate: Record<string, unknown> = {
    shopify_access_token: null,
    shopify_refresh_token: null,
    shopify_token_expires_at: null,
    subscription_tier: "free",
    shopify_subscription_id: null,
    shopify_install_status: "redacted",
    shopify_redacted_at: now,
    shopify_uninstalled_at: now,
    shop_domain: null,
    global_production_location: null,
    global_care_instructions: null,
    production_location_proof_url: null,
    care_instructions_proof_url: null,
    name: `Redacted Shopify store ${shopId ?? orgId.slice(0, 8)}`,
  }
  if (shopId != null) orgUpdate.shopify_shop_id = shopId

  const { error: orgError } = await supabase.from("organizations").update(orgUpdate).eq("id", orgId)

  if (orgError) {
    console.error("[shopify/compliance] shop/redact org update failed:", orgError.message)
    return { ok: false, reason: "update_failed" }
  }

  // Best-effort prefix purge for any orphaned objects keyed by shop domain.
  if (shopDomain) {
    const { data: listed } = await supabase.storage.from("supplier-certificates").list(shopDomain, {
      limit: 1000,
    })
    if (listed?.length) {
      const orphanPaths = listed.map((obj) => `${shopDomain}/${obj.name}`)
      await supabase.storage.from("supplier-certificates").remove(orphanPaths)
    }
  }

  console.info("[shopify/compliance] shop/redact completed", {
    shop,
    tierWiped: org.subscription_tier ?? "free",
  })
  return { ok: true }
}

/**
 * Data-portability export for customers/data_request. OriginPass keys no tables
 * by Shopify customer id (public passport scans are anonymous: hashed IP +
 * coarse geo only), so today's export is a truthful empty dataset, logged as an
 * audit trail for the merchant's statutory response. If customer-keyed tables
 * are ever added, enumerate them here — this is the single integration point.
 */
export async function exportCustomerDataForRequest(input: {
  shop: string
  shopId: number | null
  customerId: number | null
  dataRequestId?: number | null
}): Promise<{ records: unknown[]; note: string }> {
  const result = {
    records: [] as unknown[],
    note: "OriginPass stores no Shopify-customer-keyed records; passport scan analytics are anonymous (hashed IP, coarse geo) and cannot be associated with a customer id.",
  }
  console.info("[shopify/compliance] customers/data_request export produced", {
    ...input,
    recordCount: result.records.length,
  })
  return result
}

/**
 * Right-to-be-forgotten wipe for customers/redact. Same schema truth as above:
 * there is no customer-keyed consumer trace data to match, so the wipe is a
 * verified no-op. Any future customer-keyed table must add its DELETE here.
 */
export async function purgeCustomerTraceData(input: {
  shop: string
  shopId: number | null
  customerId: number | null
}): Promise<{ deleted: number }> {
  console.info("[shopify/compliance] customers/redact purge completed", {
    ...input,
    deleted: 0,
    reason: "no_customer_keyed_tables",
  })
  return { deleted: 0 }
}

/**
 * customers/redact — OriginPass does not store Shopify customer records.
 * Acknowledge for App Store compliance; no data to purge.
 */
export async function handleShopifyCustomerRedact(
  shop: string,
  shopId: number | null,
  customerId: number | null,
): Promise<ComplianceResult> {
  await purgeCustomerTraceData({ shop, shopId, customerId })
  return { ok: true, skipped: true, reason: "no_customer_data" }
}

/**
 * customers/data_request — OriginPass does not store Shopify customer records.
 * Log for operational follow-up; merchant receives empty dataset.
 */
export async function handleShopifyCustomerDataRequest(
  shop: string,
  shopId: number | null,
  customerId: number | null,
): Promise<ComplianceResult> {
  await exportCustomerDataForRequest({ shop, shopId, customerId })
  return { ok: true, skipped: true, reason: "no_customer_data" }
}
