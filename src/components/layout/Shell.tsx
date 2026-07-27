import { Suspense } from "react"
import Image from "next/image"
import NextLink from "next/link"
import { Link } from "@/i18n/navigation"
import { WideContainer } from "@/components/layout/Containers"
import { Container } from "@/components/ui/Container"
import HeaderAuthStatus from "@/components/layout/HeaderAuthStatus"
import MainNav from "@/components/layout/MainNav"
import { PublicMarketingNav } from "@/components/layout/PublicMarketingNav"
import { BLOG_GUIDE_LINKS, BLOG_PATHS } from "@/lib/blog-links"

type LayoutVariant = "narrow" | "wide"

export function SiteHeader({ variant = "narrow" }: { variant?: LayoutVariant }) {
  const ShellContainer = variant === "wide" ? WideContainer : Container
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <ShellContainer className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Image
            src="/brand/originpass-icon.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
            priority
          />
          OriginPass
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <PublicMarketingNav />
          <Suspense
            fallback={<div className="hidden h-4 w-32 animate-pulse rounded bg-slate-100 lg:block" aria-hidden />}
          >
            <MainNav />
          </Suspense>
          <HeaderAuthStatus />
        </div>
      </ShellContainer>
    </header>
  )
}

export function SiteFooter({ variant = "narrow" }: { variant?: LayoutVariant }) {
  const ShellContainer = variant === "wide" ? WideContainer : Container
  return (
    <footer className="mt-auto border-t border-gray-100 bg-gray-50">
      <ShellContainer className="flex flex-col gap-8 py-10 text-xs text-slate-500">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">OriginPass</p>
            <p className="max-w-sm text-[11px] leading-relaxed text-slate-400">
              Digital Product Passport and traceability for brands that need proof without complexity.
            </p>
            <p>© {new Date().getFullYear()} OriginPass. All rights reserved.</p>
          </div>

          <nav className="space-y-3" aria-label="Product">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Product</p>
            <div className="flex flex-col gap-2">
              <Link href="/dashboard/product-identity" className="hover:text-slate-900">
                Product
              </Link>
              <Link href="/pricing" className="hover:text-slate-900">
                Pricing
              </Link>
              <Link href="/documentation" className="hover:text-slate-900">
                Docs
              </Link>
              <Link href="/compliance" className="hover:text-slate-900">
                Compliance
              </Link>
            </div>
          </nav>

          <nav className="space-y-3" aria-label="Resources">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Resources</p>
            <div className="flex flex-col gap-2">
              <NextLink href={BLOG_PATHS.home} className="hover:text-slate-900">
                Blog
              </NextLink>
              {BLOG_GUIDE_LINKS.map((guide) => (
                <NextLink key={guide.key} href={guide.href} className="hover:text-slate-900">
                  {guide.label}
                </NextLink>
              ))}
            </div>
          </nav>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200/80 pt-6" aria-label="Legal">
          <Link href="/privacy" className="hover:text-slate-900">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-900">
            Terms
          </Link>
        </nav>
      </ShellContainer>
    </footer>
  )
}
