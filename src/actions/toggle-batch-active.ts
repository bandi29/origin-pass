"use server"

import { createClient } from "@/lib/supabase/server"

export interface ToggleBatchActiveResult {
  success: boolean
  error?: string
}

export async function toggleBatchActive(batchId: string, isActive: boolean): Promise<ToggleBatchActiveResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    const { error } = await supabase
      .from("batches")
      .update({ is_active: isActive })
      .eq("id", batchId)
      .eq("brand_id", user.id)

    if (error) {
      console.error("Toggle batch active error:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error("Toggle batch active exception:", error)
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
