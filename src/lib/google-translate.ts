/**
 * Google Cloud Translation (API key) — uses the v2 client from
 * `@google-cloud/translate`, which accepts `GOOGLE_TRANSLATE_API_KEY` /
 * `GOOGLE_API_KEY` without a service-account JSON file.
 */

import { v2 } from "@google-cloud/translate"

const { Translate } = v2

export type GoogleTranslateBatchResult = {
  translations: string[]
  characters: number
}

function resolveApiKey(): string {
  const key =
    process.env.GOOGLE_TRANSLATE_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || ""
  if (!key) {
    throw new Error(
      "Missing GOOGLE_TRANSLATE_API_KEY (or GOOGLE_API_KEY) for Cloud Translation.",
    )
  }
  return key
}

let client: InstanceType<typeof Translate> | null = null

function getClient(): InstanceType<typeof Translate> {
  if (!client) {
    client = new Translate({ key: resolveApiKey() })
  }
  return client
}

/**
 * Translate one or more strings EN → targetLang (BCP-47 / ISO-639-1).
 * Empty inputs are preserved as empty strings without calling Google.
 */
export async function translateTextsToLang(
  texts: string[],
  targetLang: string,
): Promise<GoogleTranslateBatchResult> {
  if (texts.length === 0) return { translations: [], characters: 0 }

  const indices: number[] = []
  const payload: string[] = []
  texts.forEach((t, i) => {
    if (t.trim()) {
      indices.push(i)
      payload.push(t)
    }
  })

  const out = [...texts]
  if (payload.length === 0) return { translations: out, characters: 0 }

  const characters = payload.reduce((n, s) => n + s.length, 0)
  const translate = getClient()
  const [translated] = await translate.translate(payload, {
    from: "en",
    to: targetLang,
  })

  const list = Array.isArray(translated) ? translated : [translated]
  list.forEach((value, j) => {
    const idx = indices[j]
    if (idx != null) out[idx] = typeof value === "string" ? value : String(value ?? "")
  })

  return { translations: out, characters }
}
