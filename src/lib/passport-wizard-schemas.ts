import { z } from "zod"

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

export const createProductBodySchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(200),
  description: z.string().max(8000).optional().nullable(),
  category: z.string().max(200).optional().nullable(),
  originCountry: z.string().max(120).optional().nullable(),
  originRegion: z.string().max(120).optional().nullable(),
})

export const patchProductBodySchema = createProductBodySchema.partial()

export const passportUpsertBodySchema = z.object({
  productId: z.string().uuid(),
  story: z.string().max(20000).optional().nullable(),
  materials: z.array(materialRowSchema).optional(),
  timeline: z.array(timelineRowSchema).optional(),
})

export const qrcodeBodySchema = z.object({
  passportId: z.string().uuid(),
})

export type MaterialRow = z.infer<typeof materialRowSchema>
export type TimelineRow = z.infer<typeof timelineRowSchema>
