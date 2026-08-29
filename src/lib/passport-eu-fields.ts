import { z } from "zod"
import { EU_TRANSLATE_LANGS, type EuTranslateLang } from "@/lib/passport-eu-lang"

export type { EuTranslateLang }
export { EU_TRANSLATE_LANGS }

export const euTranslateLangSchema = z.enum(EU_TRANSLATE_LANGS)

/** Per-language DPP field bundle (flat strings for Google Translate + merchant edit). */
export const passportTranslationFieldsSchema = z.object({
  materials: z.string(),
  origin: z.string(),
  care: z.string(),
  sustainability: z.string(),
})

export type PassportTranslationFields = z.infer<typeof passportTranslationFieldsSchema>

export const passportTranslationsMetaSchema = z.object({
  sourceHash: z.string().min(1),
  updatedAt: z.string().optional(),
})

export const passportTranslationsColumnSchema = z
  .object({
    fr: passportTranslationFieldsSchema.optional(),
    de: passportTranslationFieldsSchema.optional(),
    es: passportTranslationFieldsSchema.optional(),
    it: passportTranslationFieldsSchema.optional(),
    _meta: passportTranslationsMetaSchema.optional(),
  })
  .passthrough()

export type PassportTranslationsColumn = z.infer<typeof passportTranslationsColumnSchema>

export const translatePassportBodySchema = z.object({
  passportId: z.string().uuid(),
  targetLangs: z
    .array(euTranslateLangSchema)
    .min(1)
    .max(4)
    .default([...EU_TRANSLATE_LANGS]),
  force: z.boolean().optional().default(false),
})

export type TranslatePassportBody = z.infer<typeof translatePassportBodySchema>

export const savePassportTranslationsBodySchema = z.object({
  passportId: z.string().uuid(),
  translations: z
    .object({
      fr: passportTranslationFieldsSchema.optional(),
      de: passportTranslationFieldsSchema.optional(),
      es: passportTranslationFieldsSchema.optional(),
      it: passportTranslationFieldsSchema.optional(),
    })
    .refine((value) => Object.values(value).some(Boolean), {
      message: "Provide at least one language to save.",
    }),
})

/** Map dashboard EN product fields → DPP translation keys. */
export function englishSourceFromProduct(content: {
  story: string
  materials: string
  origin: string
  lifecycle: string
}): PassportTranslationFields {
  return {
    materials: (content.materials ?? "").trim(),
    origin: (content.origin ?? "").trim(),
    care: (content.lifecycle ?? "").trim(),
    sustainability: (content.story ?? "").trim(),
  }
}

export function parseTranslationsColumn(raw: unknown): PassportTranslationsColumn {
  const parsed = passportTranslationsColumnSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : {}
}

export function isLangCacheFresh(
  column: PassportTranslationsColumn,
  lang: EuTranslateLang,
  sourceHash: string,
): boolean {
  const row = column[lang]
  if (!row) return false
  if (column._meta?.sourceHash !== sourceHash) return false
  return (
    typeof row.materials === "string" &&
    typeof row.origin === "string" &&
    typeof row.care === "string" &&
    typeof row.sustainability === "string"
  )
}

export function nonemptySourceFields(
  source: PassportTranslationFields,
): Array<keyof PassportTranslationFields> {
  return (Object.keys(source) as Array<keyof PassportTranslationFields>).filter(
    (k) => source[k].length > 0,
  )
}

export function translationFieldsHaveContent(
  fields: PassportTranslationFields | undefined | null,
): boolean {
  if (!fields) return false
  return Boolean(
    fields.materials?.trim() ||
      fields.origin?.trim() ||
      fields.care?.trim() ||
      fields.sustainability?.trim(),
  )
}
