import OpenAI from "openai"
import { resolveOpenaiApiKey } from "@/lib/env-local-file"

export function requireOpenAI(): OpenAI {
  const key = resolveOpenaiApiKey()
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return new OpenAI({ apiKey: key })
}

export const STORY_MODEL = process.env.OPENAI_STORY_MODEL?.trim() || "gpt-4o-mini"
export const TRANSLATE_MODEL = process.env.OPENAI_TRANSLATE_MODEL?.trim() || "gpt-4o-mini"
