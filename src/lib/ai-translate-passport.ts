import { requireOpenAI, TRANSLATE_MODEL } from "@/lib/openai-client"

const LANG_NAMES: Record<string, string> = {
  fr: "French",
  es: "Spanish",
  it: "Italian",
  en: "English",
}

export function languageDisplayName(code: string): string {
  return LANG_NAMES[code] || code
}

export type PassportTranslatePayload = {
  story: string
  materials: Array<{ name?: string; source?: string; sustainabilityTag?: string }>
  timeline: Array<{ stepName?: string; location?: string; date?: string }>
}

export async function translatePassportWithOpenAI(
  targetLanguage: string,
  payload: PassportTranslatePayload
): Promise<PassportTranslatePayload> {
  const openai = requireOpenAI()
  const langName = languageDisplayName(targetLanguage)

  const userContent = `Translate the following product passport into ${langName} (${targetLanguage}).

Requirements:
- Keep tone natural and culturally appropriate
- Do NOT translate brand names or proper nouns that are clearly brand names
- Preserve meaning, not literal words
- Output a single JSON object only, with keys: story (string), materials (array of objects with name, source, sustainabilityTag), timeline (array of objects with stepName, location, date — keep dates in ISO YYYY-MM-DD when present, translate location and stepName)

Content:
${JSON.stringify(payload)}`

  const completion = await openai.chat.completions.create({
    model: TRANSLATE_MODEL,
    messages: [{ role: "user", content: userContent }],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 4096,
  })

  const raw = completion.choices[0]?.message?.content?.trim()
  if (!raw) throw new Error("Empty translation from model")

  const parsed = JSON.parse(raw) as Partial<PassportTranslatePayload>
  return {
    story: typeof parsed.story === "string" ? parsed.story : payload.story,
    materials: Array.isArray(parsed.materials) ? (parsed.materials as PassportTranslatePayload["materials"]) : payload.materials,
    timeline: Array.isArray(parsed.timeline) ? (parsed.timeline as PassportTranslatePayload["timeline"]) : payload.timeline,
  }
}
