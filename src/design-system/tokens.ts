/**
 * OriginPass design tokens — aligns with `src/app/globals.css` @theme.
 */

export const colors = {
  primary: "#0F172A",
  secondary: "#6366F1",
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
} as const

export const typography = {
  h1: "text-2xl font-semibold tracking-tight text-ds-text",
  h2: "text-xl font-semibold text-ds-text",
  h3: "text-lg font-medium text-ds-text",

  body: "text-sm text-ds-text-muted",
  label: "text-sm font-medium text-ds-text",
  caption: "text-xs text-ds-text-muted",
} as const

/** Layout rhythm */
export const spacing = {
  page: "px-6 py-16 md:py-20",
  section: "space-y-12 md:space-y-16",
  pageStack: "space-y-12 md:space-y-16",
  stackDense: "space-y-6 md:space-y-8",
  card: "p-6",
  gap: "gap-8",
  sectionY: "py-28 md:py-32",
  main: "py-10 md:py-12",
} as const

/** Global card — lift + shadow on hover (`Card` adds `p-6` when `padding`) */
export const surfaces = {
  card:
    "rounded-2xl border border-border bg-white shadow-sm transition-all duration-200 ease-smooth hover:-translate-y-1 hover:shadow-lg",
  cardInteractive:
    "rounded-2xl border border-border bg-white shadow-sm transition-all duration-200 ease-smooth hover:-translate-y-1 hover:shadow-lg",
} as const
