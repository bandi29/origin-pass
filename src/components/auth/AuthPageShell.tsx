import type { ReactNode } from "react"
import { authUi } from "@/components/auth/auth-ui"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import {
  SimplePageBreadcrumbs,
  type BreadcrumbEntry,
} from "@/components/layout/SimplePageBreadcrumbs"

type AuthPageShellProps = {
  children: ReactNode
  /** Left panel (desktop) — value prop */
  marketing?: {
    title: string
    body: string
    footer?: string
  }
  /** e.g. Home › Sign in — replaces ad-hoc “back” links */
  breadcrumbs?: BreadcrumbEntry[]
}

export function AuthPageShell({
  children,
  marketing,
  breadcrumbs,
}: AuthPageShellProps) {
  return (
    <div className={`flex min-h-screen flex-col ${authUi.page}`}>
      <SiteHeader />
      <main className="flex flex-1">
        {marketing ? (
          <>
            <div className={authUi.marketingPanel}>
              <div className={authUi.marketingGradient} aria-hidden />
              <div className={authUi.marketingContent}>
                <p className={authUi.marketingKicker}>OriginPass</p>
                <h2 className={authUi.marketingTitle}>{marketing.title}</h2>
                <p className={authUi.marketingBody}>{marketing.body}</p>
              </div>
              {marketing.footer ? (
                <p className={authUi.marketingFooter}>{marketing.footer}</p>
              ) : (
                <p className={authUi.marketingFooter}>Built for authentic brands and scale.</p>
              )}
            </div>
            <div className={authUi.formColumn}>
              <div className="mb-6 flex justify-end lg:hidden">
                <Link href="/support" className={authUi.linkMuted}>
                  Help
                </Link>
              </div>
              {breadcrumbs?.length ? (
                <div className="mx-auto mb-6 w-full max-w-[400px] lg:mx-0">
                  <SimplePageBreadcrumbs items={breadcrumbs} />
                </div>
              ) : null}
              <div className={authUi.formInner}>{children}</div>
              <div className="mx-auto mt-10 hidden w-full max-w-[400px] justify-end text-[13px] text-zinc-400 lg:flex">
                <Link href="/support" className="hover:text-zinc-700">
                  Need help?
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">{children}</div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}

/** Centered card layout (forgot password, reset password, signup complete) */
export function AuthCardShell({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-h-screen flex-col ${authUi.page}`}>
      <SiteHeader />
      <main className={`flex flex-1 items-center justify-center px-4 py-12 ${className}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
