import { Suspense } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { WideContainer } from "@/components/layout/Containers"
import { Container } from "@/components/ui/Container"
import HeaderAuthStatus from "@/components/layout/HeaderAuthStatus"
import MainNav from "@/components/layout/MainNav"

type LayoutVariant = "narrow" | "wide"

export function SiteHeader({ variant = "narrow" }: { variant?: LayoutVariant }) {
    const ShellContainer = variant === "wide" ? WideContainer : Container
    return (
        <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md">
            <ShellContainer className="h-16 flex items-center justify-between gap-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 text-lg">
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
                <div className="flex items-center gap-3">
                    <Suspense fallback={<div className="hidden h-4 w-32 animate-pulse rounded bg-slate-100 lg:block" aria-hidden />}>
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
            <ShellContainer className="flex flex-col gap-6 py-10 text-xs text-slate-500">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <p>© {new Date().getFullYear()} OriginPass. All rights reserved.</p>
                    <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
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
                        <Link href="/privacy" className="hover:text-slate-900">
                            Privacy
                        </Link>
                        <Link href="/terms" className="hover:text-slate-900">
                            Terms
                        </Link>
                    </nav>
                </div>
                <p className="text-[11px] text-slate-400 max-w-2xl">
                    Digital Product Passport and traceability for brands that need proof without
                    complexity.
                </p>
            </ShellContainer>
        </footer>
    )
}
