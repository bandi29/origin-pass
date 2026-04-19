/**
 * Marketing landing — type scale + hero grid.
 * Narrower reading column inside Section’s max-w-6xl shell.
 */
export const marketingContentColumn = "mx-auto w-full max-w-5xl"

/**
 * Vertical rhythm inside a band (flex gap — reliable in Safari vs margin-based space-y)
 */
export const marketingBandStack = "flex w-full flex-col gap-10 md:gap-14"

export const marketingLayout = {
  /** Hero copy stack; flex-1 lives on parent wrapper in MarketingHome. */
  heroCopy:
    "flex min-h-0 min-w-0 flex-col gap-6 text-center lg:max-w-xl lg:text-left",
  heroTitle:
    "text-4xl font-bold leading-tight tracking-tight text-black md:text-[44px] md:leading-[52px]",
  sectionTitle: "text-3xl font-bold leading-tight text-black md:text-[30px] md:leading-[38px]",
  body: "text-[16px] leading-[26px] text-gray-600",
  label: "text-xs font-medium uppercase tracking-wide text-gray-400",
} as const

export type MarketingIconTone =
  | "blue"
  | "purple"
  | "green"
  | "emerald"
  | "orange"

const iconToneClass: Record<MarketingIconTone, string> = {
  blue: "bg-blue-soft text-blue-600",
  purple: "bg-purple-soft text-purple-600",
  green: "bg-green-soft text-green-600",
  emerald: "bg-green-soft text-emerald-600",
  orange: "bg-orange-soft text-orange-600",
}

export function marketingIconBoxClass(tone: MarketingIconTone): string {
  return `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ease-smooth group-hover:scale-110 ${iconToneClass[tone]}`
}

