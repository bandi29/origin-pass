/**
 * OriginPass design tokens — the single source of truth for radii, elevations,
 * borders, surfaces, tones, motion, and typography presets used across the app.
 *
 * Adoption note: these tokens are ADDITIVE. Existing inline Tailwind utility
 * classes (`rounded-2xl border border-slate-200 …`) keep working; new code and
 * migrations should reach for the named tokens here so visual language stays
 * coherent across pages.
 */

export const colors = {
  /** Primary = the true brand navy. Unified with `brandNavy` (was slate-900). */
  primary: "#0B1F4D",
  /** Interaction / focus accent — navy, replacing the generic dev-indigo. */
  secondary: "#0B1F4D",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",

  background: "#F8FAFC",
  surface: "#FFFFFF",
  canvas: "#F8FAFC",

  textPrimary: "#0F172A",
  textSecondary: "#64748B",

  border: "#E2E8F0",

  blueSoft: "#DBEAFE",
  purpleSoft: "#EDE9FE",
  greenSoft: "#DCFCE7",
  orangeSoft: "#FFEDD5",
  goldSoft: "#F7F1E0",

  /** Brand navy — primary CTAs, selected pills, studio chrome, focus accent. */
  brandNavy: "#0B1F4D",
  brandNavyStrong: "#081636",

  /** Gold accent (antique / champagne) — the heritage "premium" signal.
   *  `gold` is contrast-safe (~5:1 on white) for text; `goldBright` for fills. */
  gold: "#9A7B2E",
  goldStrong: "#826724",
  goldBright: "#C9A227",
} as const

export const typography = {
  h1: "text-2xl font-semibold tracking-tight text-ds-text",
  h2: "text-xl font-semibold text-ds-text",
  h3: "text-lg font-medium text-ds-text",

  body: "text-sm text-ds-text-muted",
  label: "text-sm font-medium text-ds-text",
  caption: "text-xs text-ds-text-muted",

  /** Page-level heading utilities — match globals.css and replace ad-hoc
   *  `text-3xl font-bold` patterns scattered across module pages. */
  pageTitle: "text-2xl font-semibold tracking-tight text-ds-text md:text-3xl",
  pageLede: "mt-2 max-w-2xl text-sm leading-relaxed text-ds-text-muted",
} as const

/** Layout rhythm */
export const spacing = {
  page: "px-6 py-16 md:py-20",
  section: "space-y-12 md:space-y-16",
  pageStack: "space-y-12 md:space-y-16",
  stackDense: "space-y-6 md:space-y-8",
  /** AppShell main column: padding under global search card, above footer */
  dashboardMain: "px-4 pt-6 pb-10 md:px-6 md:pb-12",
  /** Tight vertical rhythm: trust/upgrade row → breadcrumbs → page body */
  dashboardChromeStack: "space-y-3 md:space-y-4",
  card: "p-6",
  gap: "gap-8",
  sectionY: "py-28 md:py-32",
  main: "py-10 md:py-12",
} as const

/**
 * Named corner radii. Use these instead of `rounded-xl`/`rounded-2xl` literals
 * so a future tweak (e.g. `card` → 24px corners app-wide) is one edit.
 *
 *   control = inputs, buttons, selects
 *   card    = cards, modals, toasts, sheets
 *   tile    = checklist rows, list items, table cells
 *   chip    = status pills, avatars, dots
 *   hero    = large feature blocks (public passport landing, marketing)
 */
export const radius = {
  control: "rounded-xl",
  card: "rounded-2xl",
  tile: "rounded-lg",
  chip: "rounded-full",
  hero: "rounded-3xl",
} as const

/**
 * Elevation scale. Maps directly to Tailwind shadow utilities for now; if a
 * design system version 2 changes shadow values, callers don't update.
 *
 *   resting = default surface
 *   hover   = hovered surface
 *   raised  = persistent emphasis (active tab, focused row)
 *   overlay = modals, popovers, toasts — anything floating above content
 */
export const elevation = {
  none: "shadow-none",
  resting: "shadow-sm",
  hover: "shadow-md",
  raised: "shadow-lg",
  overlay: "shadow-xl",
} as const

/**
 * Named border styles. Picks `border-ds-border` (the canonical hairline token
 * from globals.css `@theme`) over the half-dozen flavours of `border-slate-100|
 * 200|300|gray-200` that drifted across pages.
 */
export const borders = {
  hairline: "border border-ds-border",
  hairlineSoft: "border border-ds-border/70",
  emphasized: "border border-slate-300",
  dashed: "border border-dashed border-ds-border",
} as const

/** Foreground tone presets. Use instead of raw `text-slate-500|600`. */
export const textTone = {
  primary: "text-ds-text",
  muted: "text-ds-text-muted",
  subtle: "text-ds-text-muted/80",
  onDark: "text-white",
  onDarkMuted: "text-slate-200",
} as const

/** Soft icon-chip tone palettes. Pair with `<IconChip tone>` or `surfaces.*`.
 *  Tones use explicit text colours (not the `secondary` token) so repointing
 *  the brand accent never clashes with a chip's background. */
export const tones = {
  indigo: "bg-blue-soft text-blue-700",
  emerald: "bg-green-soft text-success",
  amber: "bg-orange-soft text-warning",
  rose: "bg-rose-50 text-danger",
  violet: "bg-purple-soft text-violet-600",
  slate: "bg-slate-100 text-slate-600",
  navy: "bg-[#0B1F4D]/8 text-[#0B1F4D]",
  /** Heritage gold — reserve for premium / certification moments. */
  gold: "bg-gold-soft text-[#826724]",
} as const

export type ToneName = keyof typeof tones

/**
 * Motion presets. The `ease-smooth` curve is declared in globals.css; the press
 * + lift presets capture the two interaction idioms used across the app.
 */
export const motion = {
  smooth: "transition-all duration-200 ease-smooth",
  fast: "transition-colors duration-150 ease-smooth",
  press: "active:scale-95",
  liftHover: "hover:-translate-y-1 hover:shadow-lg",
} as const

/**
 * Composed surfaces. Every "card" in the app should reach for one of these
 * instead of rebuilding `rounded-2xl border border-slate-200 bg-white shadow-sm`
 * by hand. Keeps radius, border colour, and shadow synchronised app-wide.
 */
export const surfaces = {
  card: `${radius.card} ${borders.hairline} bg-white ${elevation.resting}`,
  cardInteractive: `${radius.card} ${borders.hairline} bg-white ${elevation.resting} ${motion.smooth} ${motion.liftHover} hover:border-slate-300`,
  cardSoft: `${radius.card} ${borders.hairline} bg-canvas`,
  heroDark: `${radius.card} bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white ${elevation.hover}`,
  overlay: `${radius.card} ${borders.hairline} bg-white ${elevation.overlay}`,
  emptyState: `${radius.card} ${borders.dashed} bg-white/70`,
  tile: `${radius.tile} ${borders.hairline} bg-white ${elevation.none}`,
  pill: `${radius.chip} ${borders.hairline} bg-white`,
} as const
