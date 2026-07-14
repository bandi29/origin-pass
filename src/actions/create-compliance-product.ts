"use server"

import { createClient } from "@/lib/supabase/server"
import { buildProductJsonLd } from "@/lib/dpp-export"
import type { CategoryKey } from "@/lib/compliance/category-schemas"
import { categorySchemas } from "@/lib/compliance/category-schemas"
import type { ComplianceData } from "@/lib/compliance/category-compliance-strategy"
import { type CategoryProductPayload, validateCategoryProduct } from "@/lib/compliance/validate-category-product"
import { ensureBrandProfile } from "@/lib/tenancy"
import type { ProductAiMetadata } from "@/lib/compliance/product-ai-metadata"
import {
  persistVerificationOutputs,
  runVerificationOrchestrator,
} from "@/backend/modules/verification-engine"
import { summarizeMaterials, summarizeOrigin } from "@/lib/compliance/compliance-field-summaries"

export interface CreateComplianceProductResult {
  success: boolean
  productId?: string
  dppReadinessScore?: number
  error?: string
}

function isMissingJsonLdColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return code === "PGRST204" && message.includes("json_ld")
}

function isMissingAiMetadataColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return code === "PGRST204" && message.includes("ai_metadata")
}

function insertErrorDetail(error: unknown): string {
  if (!error || typeof error !== "object") return ""
  const e = error as { message?: unknown; code?: unknown; details?: unknown }
  const message = typeof e.message === "string" ? e.message.trim() : ""
  const details = typeof e.details === "string" ? e.details.trim() : ""
  const code = typeof e.code === "string" ? e.code.trim() : ""
  const body = [message, details].filter(Boolean).join(" — ")
  if (!body) return ""
  return code ? `${code}: ${body}` : body
}

export async function createComplianceProduct(raw: {
  complianceCategoryKey: CategoryKey
  name: string
  sku?: string | null
  complianceData?: ComplianceData
  aiMetadata?: ProductAiMetadata | null
}): Promise<CreateComplianceProductResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    await ensureBrandProfile(supabase, user)

    let organizationId: string | null = null
    try {
      const { data: userRow } = await supabase.from("users").select("organization_id").eq("id", user.id).maybeSingle()
      organizationId = userRow?.organization_id ?? null
    } catch {
      organizationId = null
    }

    const complianceData: ComplianceData = { ...(raw.complianceData ?? {}) }

    const payload: CategoryProductPayload = {
      complianceCategoryKey: raw.complianceCategoryKey,
      name: raw.name.trim(),
      sku: raw.sku ?? null,
      complianceData,
    }

    const validated = validateCategoryProduct(payload)
    if (!validated.ok) {
      return { success: false, error: validated.errors.join(" ") }
    }

    const schema = categorySchemas[payload.complianceCategoryKey]
    const { computeDppReadinessScore } = await import("@/lib/compliance/validate-category-product")
    const dppReadinessScore = computeDppReadinessScore(payload.complianceCategoryKey, payload.complianceData)

    const { data: brand } = await supabase.from("profiles").select("brand_name").eq("id", user.id).single()

    const story = String(complianceData.product_story ?? "").trim()
    const materials = summarizeMaterials(payload.complianceCategoryKey, complianceData)
    const origin = summarizeOrigin(complianceData)

    const jsonLd = buildProductJsonLd({
      name: payload.name,
      story: story || null,
      materials: materials || null,
      origin: origin || null,
      lifecycle: null,
      imageUrl: (complianceData.hero_image_url as string) || null,
      brandName: brand?.brand_name ?? null,
    })

    const row = {
      brand_id: user.id,
      organization_id: organizationId,
      name: payload.name,
      sku: payload.sku?.trim() || null,
      category: schema.label,
      compliance_category_key: payload.complianceCategoryKey,
      story: story || null,
      materials: materials || null,
      origin: origin || null,
      lifecycle: null,
      image_url: (complianceData.hero_image_url as string)?.trim() || null,
      base_data: {} as Record<string, unknown>,
      compliance_data: complianceData,
      traceability_data: {} as Record<string, unknown>,
      is_archived: false,
      json_ld: jsonLd,
      ...(raw.aiMetadata
        ? { ai_metadata: raw.aiMetadata as Record<string, unknown> }
        : {}),
    }

    const { data: product, error } = await supabase.from("products").insert(row).select("id").single()

    if (error) {
      if (isMissingAiMetadataColumn(error) && "ai_metadata" in row) {
        const { ai_metadata: _drop, ...withoutAi } = row as typeof row & {
          ai_metadata?: unknown
        }
        const { data: p2, error: e2 } = await supabase
          .from("products")
          .insert(withoutAi)
          .select("id")
          .single()
        if (!e2 && p2?.id) {
          return { success: true, productId: p2.id as string, dppReadinessScore }
        }
      }
      if (isMissingJsonLdColumn(error)) {
        const { data: p2, error: e2 } = await supabase
          .from("products")
          .insert({
            brand_id: user.id,
            organization_id: organizationId,
            name: payload.name,
            sku: payload.sku?.trim() || null,
            category: schema.label,
            story: row.story,
            materials: row.materials,
            origin: row.origin,
            lifecycle: row.lifecycle,
            image_url: row.image_url,
            is_archived: false,
          })
          .select("id")
          .single()
        if (!e2 && p2?.id) {
          return { success: true, productId: p2.id as string, dppReadinessScore }
        }
      }
      console.error("createComplianceProduct", error)
      const detail = insertErrorDetail(error)
      return {
        success: false,
        error: detail
          ? `${detail} — If columns are missing, run the SQL in supabase/migrations/20260414_category_compliance_product_columns.sql and 20260415_product_ai_metadata.sql (Supabase Dashboard → SQL Editor), or run: supabase link && supabase db push`
          : "Could not save product. Apply migrations 20260414_category_compliance_product_columns and 20260415_product_ai_metadata (or check server logs).",
      }
    }

    const productId = product?.id as string
    if (productId) {
      try {
        const orchestrator = await runVerificationOrchestrator(
          {
            supabase,
            organizationId,
            actor: user.id,
          },
          {
            currentRiskScore: 0,
            product: {
              productId,
              sku: payload.sku ?? null,
              serialNumber: null,
              originCountry: String(complianceData.origin_country ?? "") || null,
              supplierId: String(complianceData.supplier_id ?? "") || null,
              materials: materials
                ? [{ name: "primary", compositionPercentage: 100 }]
                : [],
            },
          },
        )

        await persistVerificationOutputs(
          { supabase, organizationId, actor: user.id },
          productId,
          orchestrator,
        )

        await supabase
          .from("products")
          .update({
            risk_score: orchestrator.riskAfter,
            verification_status: orchestrator.status,
            lifecycle_status: "validated",
          })
          .eq("id", productId)
      } catch (verificationError) {
        console.warn("verification orchestrator skipped:", verificationError)
      }
    }

    return { success: true, productId, dppReadinessScore }
  } catch (e) {
    console.error(e)
    return { success: false, error: "Unexpected error saving product." }
  }
}

/**
 * Wizard step 1: create a compliance product shell (empty `compliance_data`) without full
 * category validation so users can fill required fields in step 2.
 */
export async function createComplianceWizardStep1(raw: {
  complianceCategoryKey: CategoryKey
  name: string
  sku?: string | null
}): Promise<CreateComplianceProductResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    await ensureBrandProfile(supabase, user)

    let organizationId: string | null = null
    try {
      const { data: userRow } = await supabase.from("users").select("organization_id").eq("id", user.id).maybeSingle()
      organizationId = userRow?.organization_id ?? null
    } catch {
      organizationId = null
    }

    const name = raw.name.trim()
    if (name.length < 3) {
      return { success: false, error: "Product name must be at least 3 characters." }
    }

    const schema = categorySchemas[raw.complianceCategoryKey]
    if (!schema) {
      return { success: false, error: "Unknown compliance category" }
    }

    const complianceData: ComplianceData = {}
    const { computeDppReadinessScore } = await import("@/lib/compliance/validate-category-product")
    const dppReadinessScore = computeDppReadinessScore(raw.complianceCategoryKey, complianceData)

    const { data: brand } = await supabase.from("profiles").select("brand_name").eq("id", user.id).single()

    const jsonLd = buildProductJsonLd({
      name,
      story: null,
      materials: null,
      origin: null,
      lifecycle: null,
      imageUrl: null,
      brandName: brand?.brand_name ?? null,
    })

    const row = {
      brand_id: user.id,
      organization_id: organizationId,
      name,
      sku: raw.sku?.trim() || null,
      category: schema.label,
      compliance_category_key: raw.complianceCategoryKey,
      story: null,
      materials: null,
      origin: null,
      lifecycle: null,
      image_url: null,
      base_data: {} as Record<string, unknown>,
      compliance_data: complianceData,
      traceability_data: {} as Record<string, unknown>,
      is_archived: false,
      json_ld: jsonLd,
    }

    const { data: product, error } = await supabase.from("products").insert(row).select("id").single()

    if (error) {
      if (isMissingJsonLdColumn(error)) {
        const { data: p2, error: e2 } = await supabase
          .from("products")
          .insert({
            brand_id: user.id,
            organization_id: organizationId,
            name,
            sku: raw.sku?.trim() || null,
            category: schema.label,
            story: null,
            materials: null,
            origin: null,
            lifecycle: null,
            image_url: null,
            is_archived: false,
          })
          .select("id")
          .single()
        if (!e2 && p2?.id) {
          return { success: true, productId: p2.id as string, dppReadinessScore }
        }
      }
      console.error("createComplianceWizardStep1", error)
      return { success: false, error: insertErrorDetail(error) || "Could not save product." }
    }

    return { success: true, productId: product?.id as string, dppReadinessScore }
  } catch (e) {
    console.error(e)
    return { success: false, error: "Unexpected error saving product." }
  }
}
