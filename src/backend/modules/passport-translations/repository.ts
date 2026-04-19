import { createAdminClient } from "@/lib/supabase/admin"

export type PassportTranslationRow = {
  language: string
  story: string | null
  materials: unknown
  timeline: unknown
}

export async function getPassportTranslation(
  passportId: string,
  language: string
): Promise<PassportTranslationRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passport_translations")
    .select("language, story, materials, timeline")
    .eq("passport_id", passportId)
    .eq("language", language)
    .maybeSingle()

  if (error) {
    if (error.code === "PGRST116" || error.message?.includes("does not exist")) return null
    console.warn("getPassportTranslation:", error.message)
    return null
  }
  return data as PassportTranslationRow | null
}

export async function upsertPassportTranslation(input: {
  passportId: string
  language: string
  story: string | null
  materials: unknown
  timeline: unknown
}): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from("passport_translations").upsert(
    {
      passport_id: input.passportId,
      language: input.language,
      story: input.story,
      materials: input.materials,
      timeline: input.timeline,
      updated_at: now,
    },
    { onConflict: "passport_id,language" }
  )

  if (error) {
    console.error("upsertPassportTranslation:", error.message)
    throw new Error(error.message)
  }
}
