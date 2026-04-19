import { createAdminClient } from "@/lib/supabase/admin"

export async function createVerificationEvent(input: {
  passportId: string
  verificationType: string
  status: "pending" | "approved" | "rejected"
  reviewNotes: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("verifications")
    .insert({
      passport_id: input.passportId,
      verification_type: input.verificationType,
      status: input.status,
      review_notes: input.reviewNotes,
    })
    .select("id, passport_id, verification_type, status, created_at")
    .single()

  if (error) {
    console.warn("createVerificationEvent error:", error.message)
    return null
  }

  return data
}
