import { requireOpenAI, STORY_MODEL } from "@/lib/openai-client"
import { callUpstream } from "@/lib/resilience"
import { rememberAi } from "@/lib/ai-cache"

export function buildStoryPrompt(input: {
  name: string
  category: string | null
  origin: string | null
  description: string | null
}): string {
  return `You are a storytelling expert for artisanal and sustainable products.

Write a compelling, authentic product story based on the following details:

Product Name: ${input.name}
Category: ${input.category || "—"}
Origin: ${input.origin || "—"}
Description: ${input.description || "—"}

Requirements:
- Tone: emotional, authentic, human
- Length: 120–200 words
- Highlight craftsmanship, origin, and uniqueness
- Avoid generic marketing language
- Make it feel like a real artisan story

Return only the story text.`
}

export async function generateProductStoryWithOpenAI(
  input: {
    name: string
    category: string | null
    origin: string | null
    description: string | null
  },
  options: { skipCache?: boolean } = {},
): Promise<string> {
  // Input-hash cache: identical product details produce the same story. Repeated
  // regenerations (draft cycles, A/B compare, re-imports) short-circuit to Redis.
  // The model name is part of the cache key so a model swap invalidates without
  // mass-deleting old entries.
  const cacheInput = {
    name: input.name,
    category: input.category ?? "",
    origin: input.origin ?? "",
    description: input.description ?? "",
    model: STORY_MODEL,
  }

  const { value } = await rememberAi<string>(
    "story:v1",
    cacheInput,
    async () => {
      const openai = requireOpenAI()
      const prompt = buildStoryPrompt(input)

      // Resilience pipeline: 15s timeout per attempt, up to 3 attempts with
      // exponential backoff, per-provider circuit breaker.
      const completion = await callUpstream(
        "openai",
        (signal) =>
          openai.chat.completions.create(
            {
              model: STORY_MODEL,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.85,
              max_tokens: 600,
            },
            { signal },
          ),
        { timeoutMs: 15_000, attempts: 3 },
      )
      const text = completion.choices[0]?.message?.content?.trim() || ""
      if (!text) throw new Error("Empty story from model")
      return text
    },
    { skipCache: options.skipCache },
  )

  return value
}
