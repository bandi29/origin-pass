import NextLink from "next/link"
import { BookOpen, ExternalLink } from "lucide-react"
import { BLOG_GUIDE_LINKS, BLOG_PATHS, blogAbsolutePath } from "@/lib/blog-links"
import { twMerge } from "tailwind-merge"

type DocumentationGuidesCalloutProps = {
  /** Shopify Admin iframe should open absolute prod URLs in a new tab. */
  absoluteLinks?: boolean
  className?: string
  compact?: boolean
}

/**
 * Surfaces DPP / ESPR / GS1 blog guides inside merchant dashboards and the
 * embedded Shopify app home.
 */
export function DocumentationGuidesCallout({
  absoluteLinks = false,
  className,
  compact = false,
}: DocumentationGuidesCalloutProps) {
  const resolveHref = (path: string) => (absoluteLinks ? blogAbsolutePath(path) : path)

  return (
    <section
      aria-labelledby="docs-guides-heading"
      className={twMerge(
        compact
          ? "rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          : "rounded-2xl border border-slate-200 bg-gradient-to-br from-[#EEF1F7] via-white to-[#F7F1E0] p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className={compact ? "space-y-2" : "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"}>
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B1F4D] text-white">
              <BookOpen className="h-4 w-4" aria-hidden />
            </span>
            <h2 id="docs-guides-heading" className={compact ? "text-sm font-semibold text-slate-900" : "text-base font-semibold text-[#0B1F4D]"}>
              Documentation &amp; Compliance Guides
            </h2>
          </div>
          <p className={compact ? "text-xs leading-relaxed text-slate-600" : "max-w-2xl text-sm leading-relaxed text-slate-600"}>
            New to EU ESPR regulations? Learn how to meet compliance requirements and set up GS1 QR hangtags.
          </p>
        </div>

        <div className={compact ? "flex flex-col gap-1.5" : "flex w-full flex-col gap-2 sm:w-auto sm:min-w-[14rem]"}>
          {BLOG_GUIDE_LINKS.map((guide) => (
            <a
              key={guide.key}
              href={resolveHref(guide.href)}
              target="_blank"
              rel="noopener noreferrer"
              className={
                compact
                  ? "inline-flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-[#0B1F4D] transition hover:bg-slate-50"
                  : "inline-flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#0B1F4D] transition hover:border-[#0B1F4D]/30 hover:bg-white"
              }
            >
              <span className="min-w-0 truncate">{compact ? guide.shortLabel : guide.label}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </a>
          ))}
          {absoluteLinks ? (
            <a
              href={resolveHref(BLOG_PATHS.home)}
              target="_blank"
              rel="noopener noreferrer"
              className={
                compact
                  ? "px-2 pt-1 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  : "pt-1 text-center text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline sm:text-left"
              }
            >
              Browse all guides
            </a>
          ) : (
            <NextLink
              href={BLOG_PATHS.home}
              className={
                compact
                  ? "px-2 pt-1 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  : "pt-1 text-center text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline sm:text-left"
              }
            >
              Browse all guides
            </NextLink>
          )}
        </div>
      </div>
    </section>
  )
}
