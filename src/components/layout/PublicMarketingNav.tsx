import NextLink from "next/link"
import { Link } from "@/i18n/navigation"
import { BLOG_PATHS } from "@/lib/blog"

/**
 * Marketing links shown on the public site header.
 * Blog stays on unprefixed /blog (next/link); other marketing pages use i18n Link.
 * Blog stays visible on small screens; Pricing/Compliance appear from sm/md up.
 */
export function PublicMarketingNav() {
  const linkClass = "text-slate-500 transition-colors hover:text-slate-900"

  return (
    <nav className="flex items-center gap-3 text-sm font-medium sm:gap-5" aria-label="Marketing">
      <Link href="/pricing" className={`hidden sm:inline ${linkClass}`}>
        Pricing
      </Link>
      <NextLink href={BLOG_PATHS.home} className={linkClass}>
        Blog
      </NextLink>
      <Link href="/compliance" className={`hidden md:inline ${linkClass}`}>
        Compliance
      </Link>
    </nav>
  )
}
