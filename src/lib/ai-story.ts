import { requireOpenAI, STORY_MODEL } from "@/lib/openai-client"

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

export async function generateProductStoryWithOpenAI(input: {
  name: string
  category: string | null
  origin: string | null
  description: string | null
}): Promise<string> {
  const openai = requireOpenAI()
  const prompt = buildStoryPrompt(input)
  const completion = await openai.chat.completions.create({
    model: STORY_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.85,
    max_tokens: 600,
  })
  const text = completion.choices[0]?.message?.content?.trim() || ""
  if (!text) throw new Error("Empty story from model")
  return text
}
