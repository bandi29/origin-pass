/** Canonical traceability envelope (stored in products.traceability_data). */
export type TraceabilityOrigin = {
  country?: string
  region?: string
  facilityName?: string
  geo?: { lat: number; lng: number; label?: string }
  plotOrLotReference?: string
  chain_of_custody_notes?: string
  [key: string]: unknown
}

export type TraceabilityProcessingStep = {
  stepName?: string
  location?: string
  date?: string
  notes?: string
}

export type TraceabilityCertification = {
  name?: string
  body?: string
  certificateUrl?: string
  validUntil?: string
  scope?: string
}

export type TraceabilityBatch = {
  batchId?: string
  quantity?: string
  productionDate?: string
  notes?: string
}

export type TraceabilityBlock = {
  origin: TraceabilityOrigin
  processing: TraceabilityProcessingStep[]
  certifications: TraceabilityCertification[]
  batches: TraceabilityBatch[]
}

export function emptyTraceability(): TraceabilityBlock {
  return {
    origin: {},
    processing: [],
    certifications: [],
    batches: [],
  }
}

function coerceGeo(
  g: TraceabilityOrigin["geo"],
): { lat: number; lng: number; label?: string } | undefined {
  if (!g || typeof g !== "object") return undefined
  const latRaw = (g as { lat?: unknown }).lat
  const lngRaw = (g as { lng?: unknown }).lng
  const lat = typeof latRaw === "string" ? parseFloat(latRaw) : Number(latRaw)
  const lng = typeof lngRaw === "string" ? parseFloat(lngRaw) : Number(lngRaw)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined
  const label = (g as { label?: string }).label
  return { lat, lng, ...(label ? { label } : {}) }
}

export function normalizeTraceability(raw: unknown): TraceabilityBlock {
  if (!raw || typeof raw !== "object") return emptyTraceability()
  const o = raw as Record<string, unknown>
  const rawOrigin = o.origin && typeof o.origin === "object" ? (o.origin as TraceabilityOrigin) : {}
  const geo = coerceGeo(rawOrigin.geo)
  const origin: TraceabilityOrigin = { ...rawOrigin, ...(geo ? { geo } : {}) }
  return {
    origin,
    processing: Array.isArray(o.processing) ? (o.processing as TraceabilityProcessingStep[]) : [],
    certifications: Array.isArray(o.certifications) ? (o.certifications as TraceabilityCertification[]) : [],
    batches: Array.isArray(o.batches) ? (o.batches as TraceabilityBatch[]) : [],
  }
}
