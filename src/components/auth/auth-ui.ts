/**
 * Shared auth surface tokens — Stripe (calm), Notion (simple), Linear (crisp).
 * Use these classes for visual consistency across login, signup, reset, etc.
 */
export const authUi = {
  page: "min-h-screen bg-[#fafafa] text-zinc-900 antialiased",
  /** Marketing / brand column (split layout) */
  marketingPanel:
    "relative hidden flex-col justify-between overflow-hidden bg-zinc-950 px-10 py-12 text-white lg:flex lg:w-[44%] xl:w-[42%]",
  marketingGradient:
    "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_-10%,rgba(120,119,198,0.22),transparent),radial-gradient(ellipse_60%_50%_at_100%_100%,rgba(59,130,246,0.12),transparent)]",
  marketingContent: "relative z-10",
  marketingKicker: "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500",
  marketingTitle: "mt-5 text-[1.65rem] font-semibold leading-snug tracking-tight text-white sm:text-3xl",
  marketingBody: "mt-4 max-w-sm text-[15px] leading-relaxed text-zinc-400",
  marketingFooter: "relative z-10 text-xs text-zinc-600",
  /** Form column */
  formColumn: "flex flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:px-14 xl:px-20",
  formInner: "mx-auto w-full max-w-[400px]",
  /** Card (centered pages: forgot, reset) */
  card: "mx-auto w-full max-w-[400px] rounded-xl bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]",
  title: "text-[22px] font-semibold tracking-tight text-zinc-900",
  subtitle: "mt-2 text-[15px] leading-relaxed text-zinc-500",
  label: "mb-1.5 block text-[13px] font-medium text-zinc-700",
  /** Inputs: soft fill, hairline ring — Stripe-like */
  input:
    "w-full rounded-md border-0 bg-zinc-50 px-3 py-2.5 text-[15px] text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900/15",
  /** Segmented control (password / magic) */
  segmentWrap: "flex rounded-lg bg-zinc-100/80 p-1 ring-1 ring-inset ring-zinc-200/60",
  segmentBtn:
    "flex-1 rounded-md py-2 text-[13px] font-medium text-zinc-500 transition-colors",
  segmentBtnActive: "bg-white text-zinc-900 shadow-sm ring-1 ring-black/[0.06]",
  /** Primary CTA */
  primaryBtn:
    "flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 py-2.5 text-[15px] font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50",
  /** Text link */
  link: "font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition hover:decoration-zinc-900",
  linkMuted: "text-[13px] font-medium text-zinc-500 transition hover:text-zinc-900",
  /** Alerts */
  alertInfo: "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] leading-relaxed text-zinc-700",
  alertError:
    "rounded-lg border border-red-200/80 bg-red-50/90 px-3 py-2.5 text-[13px] leading-relaxed text-red-900",
} as const
