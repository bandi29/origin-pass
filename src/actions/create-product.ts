"use server"

import { createClient } from "@/lib/supabase/server"
import { buildProductJsonLd } from "@/lib/dpp-export"
import { ensureBrandProfile } from "@/lib/tenancy"

export interface CreateProductResult {
  success: boolean
  productId?: string
  error?: string
}

function isMissingJsonLdColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return code === "PGRST204" && message.includes("json_ld")
}

export async function createProduct(formData: FormData): Promise<CreateProductResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    await ensureBrandProfile(supabase, user)

    let organizationId: string | null = null
    try {
      const { data: userRow } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle()
      organizationId = userRow?.organization_id ?? null
    } catch {
      organizationId = null
    }

    const name = String(formData.get("name") || "").trim()
    const story = String(formData.get("story") || "").trim()
    const materials = String(formData.get("materials") || "").trim()
    const origin = String(formData.get("origin") || "").trim()
    const lifecycle = String(formData.get("lifecycle") || "").trim()
    const imageUrl = String(formData.get("imageUrl") || "").trim()

    if (!name) {
      return { success: false, error: "Product name is required" }
    }

    const { data: brand } = await supabase
      .from("profiles")
      .select("brand_name")
      .eq("id", user.id)
      .single()

    const jsonLd = buildProductJsonLd({
      name,
      story: story || null,
      materials: materials || null,
      origin: origin || null,
      lifecycle: lifecycle || null,
      imageUrl: imageUrl || null,
      brandName: brand?.brand_name ?? null,
    })

    const basePayload = {
      brand_id: user.id,
      organization_id: organizationId,
      name,
      story: story || null,
      materials: materials || null,
      origin: origin || null,
      lifecycle: lifecycle || null,
      image_url: imageUrl || null,
      is_archived: false,
    }

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        ...basePayload,
        json_ld: jsonLd,
      })
      .select("id")
      .single()

    if (error) {
      // Backward-compat: some databases may not yet have json_ld column.
      if (isMissingJsonLdColumn(error)) {
        const { data: fallbackProduct, error: fallbackError } = await supabase
          .from("products")
          .insert(basePayload)
          .select("id")
          .single()
        if (!fallbackError) {
          return { success: true, productId: fallbackProduct?.id }
        }
        console.error("Create product fallback error:", fallbackError)
        return {
          success: false,
          error: "We couldn't save the product right now. Please try again.",
        }
      }
      console.error("Create product error:", error)
      return {
        success: false,
        error: "We couldn't save the product right now. Please try again.",
      }
    }

    return { success: true, productId: product?.id }
  } catch (err) {
    console.error("Create product exception:", err)
    return {
      success: false,
      error: "Something went wrong while saving your product. Please try again.",
    }
  }
}
