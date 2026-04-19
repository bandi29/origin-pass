"use server"

import { createClient } from "@/lib/supabase/server"

export interface UpdateProfileResult {
  success: boolean
  error?: string
}

function toFriendlyProfileError(message?: string): string {
  const text = String(message || "").toLowerCase()
  if (!text) return "We couldn't save your profile right now. Please try again."
  if (text.includes("unauthorized")) return "Your session has expired. Please sign in again."
  if (text.includes("brand name is required")) return "Please enter your brand name."
  return "We couldn't save your profile right now. Please try again."
}

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: toFriendlyProfileError("Unauthorized") }
    }

    const brandName = String(formData.get("brandName") || "").trim()
    if (!brandName) {
      return { success: false, error: toFriendlyProfileError("Brand name is required") }
    }

    const { error } = await supabase
      .from("profiles")
      .update({ brand_name: brandName })
      .eq("id", user.id)

    if (error) {
      console.error("Update profile error:", error)
      return { success: false, error: toFriendlyProfileError(error.message) }
    }

    return { success: true }
  } catch (error) {
    console.error("Update profile exception:", error)
    return { success: false, error: toFriendlyProfileError(error instanceof Error ? error.message : "Unknown error") }
  }
}
