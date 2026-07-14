export type PassportThemeProduct = {
  name: string
  description: string | null
  category: string | null
  story: string | null
  materials: string | null
  origin: string | null
  image_url: string | null
  brand_id: string | null
  metadata: Record<string, unknown> | null
}

export type PassportThemeBatch = {
  production_run_name: string | null
  artisan_name: string | null
  location: string | null
  produced_at: string | null
}

export type PassportThemeMaterial = { name?: string; source?: string; sustainabilityTag?: string }
export type PassportThemeTimelineStep = { stepName?: string; location?: string; date?: string }

export type PassportThemeProps = {
  qrToken: string
  displayId: string
  passportId: string
  productData: PassportThemeProduct | null
  brandName: string
  batchData: PassportThemeBatch | null
  storyText: string | null
  structuredMaterials: PassportThemeMaterial[] | null
  timelineSteps: PassportThemeTimelineStep[] | null
  /**
   * Consumer "Home" link on public `/p/*` scans: brand `https` URL when set in metadata, else `/` (marketing).
   */
  publicHomeHref?: string
  /** Raw `brand_url` from metadata (https only) — used for the optional minimal top bar on `/p/*`. */
  brandHomeUrl?: string | null
  /** Dashboard admin opened this page with `?preview=true` — show Close Preview instead of consumer Home. */
  adminPreview?: boolean
}

export type PassportThemeComponentProps = PassportThemeProps & {
  /** When true, omit full-page chrome (used inside preview frames). */
  embed?: boolean
  /** Template preview modal: sandbox share buttons + mock copy URL. */
  sharePreview?: boolean
  /**
   * Public scan route (`/p/*`) has no next-intl provider — use `next/link` with a default-locale prefix
   * instead of `@/i18n/navigation` Link.
   */
  passportPublicScan?: boolean
}
