import { z } from "zod"
import { CATEGORY_KEYS } from "@/lib/compliance/category-schemas"
import { INDUSTRY_TEMPLATE_IDS } from "@/lib/templates"

export const materialRowSchema = z.object({
  name: z.string().max(200).optional().or(z.literal("")),
  source: z.string().max(500).optional().or(z.literal("")),
  sustainabilityTag: z.string().max(120).optional().or(z.literal("")),
})

export const timelineRowSchema = z.object({
  stepName: z.string().max(200).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  date: z.string().max(40).optional().or(z.literal("")),
})

/** EU GPSR — economic operator / responsible person in the Union. */
export const euResponsiblePersonSchema = z.object({
  name: z.string().max(200).optional().or(z.literal("")),
  company: z.string().max(200).optional().or(z.literal("")),
  /** Empty allowed while drafting; non-empty values must be a valid email. */
  email: z
    .union([z.literal(""), z.string().trim().email("Invalid EU responsible person email").max(254)])
    .optional()
    .default(""),
  address: z.string().max(1000).optional().or(z.literal("")),
  phone: z.string().max(60).optional().or(z.literal("")),
})

export const productIdentifiersSchema = z.object({
  gtin: z.string().max(20).optional().or(z.literal("")),
  hsCode: z.string().max(20).optional().or(z.literal("")),
  batchNumber: z.string().max(120).optional().or(z.literal("")),
})

export const gpsrSchema = z.object({
  // `email` carries its own `.default("")`, so this schema's OUTPUT type requires
  // it. Zod returns a `.default()` value as-is without re-parsing, so `{}` would
  // both fail the build and hand callers an object missing `email` at runtime.
  euResponsiblePerson: euResponsiblePersonSchema.optional().default({ email: "" }),
  safetyInformation: z.array(z.string().max(500)).max(20).optional().default([]),
  productIdentifiers: productIdentifiersSchema.optional().default({}),
})

export const createProductBodySchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(200),
  description: z.string().max(8000).optional().nullable(),
  category: z.string().max(200).optional().nullable(),
  originCountry: z.string().max(120).optional().nullable(),
  originRegion: z.string().max(120).optional().nullable(),
})

export const patchProductBodySchema = createProductBodySchema.partial().extend({
  /** Merged into `products.compliance_data` for compliance-category products */
  complianceData: z.record(z.string(), z.unknown()).optional(),
  sku: z.string().max(200).optional().nullable(),
  /** Sets `products.compliance_category_key` (wizard step 2 or migrations). */
  complianceCategoryKey: z.enum(CATEGORY_KEYS).optional(),
  /** Inline origin/hero fixes from secure issuance wizard (works without compliance category). */
  issuanceRemediation: z
    .object({
      originCountry: z.string().max(120).optional(),
      heroImageUrl: z.string().max(2000).optional(),
    })
    .optional(),
})

export const passportUpsertBodySchema = z.object({
  productId: z.string().uuid(),
  story: z.string().max(20000).optional().nullable(),
  materials: z.array(materialRowSchema).optional(),
  timeline: z.array(timelineRowSchema).optional(),
  /** Industry 1-click template id (apparel / artisan / jewelry). */
  industryTemplateId: z.enum(INDUSTRY_TEMPLATE_IDS).optional().nullable(),
  /** Free-form fields seeded by industry templates. */
  customFields: z.record(z.string(), z.string().max(2000)).optional(),
  /** EU GPSR responsible person, safety warnings, and identifiers. */
  gpsr: gpsrSchema.optional(),
})

export const qrcodeBodySchema = z.object({
  passportId: z.string().uuid(),
  /** Production batch size — one passport, N unique QR tracking labels. */
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
})

export type MaterialRow = z.infer<typeof materialRowSchema>
export type TimelineRow = z.infer<typeof timelineRowSchema>
export type EuResponsiblePerson = z.infer<typeof euResponsiblePersonSchema>
export type ProductIdentifiers = z.infer<typeof productIdentifiersSchema>
export type GpsrData = z.infer<typeof gpsrSchema>

export const EMPTY_GPSR: GpsrData = {
  euResponsiblePerson: { name: "", company: "", email: "", address: "", phone: "" },
  safetyInformation: [],
  productIdentifiers: { gtin: "", hsCode: "", batchNumber: "" },
}
