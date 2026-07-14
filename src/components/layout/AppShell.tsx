import { Suspense } from "react"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { WideContainer } from "@/components/layout/Containers"
import { DashboardNavShell } from "@/components/layout/DashboardNavShell"
import RouteBreadcrumbs from "@/components/layout/RouteBreadcrumbs"
import { DashboardPageLayout } from "@/components/ui/DashboardPageLayout"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { TrustStrip } from "@/components/saas/TrustStrip"
import { DashboardSearchChrome } from "@/components/layout/DashboardSearchChrome"
import { BreadcrumbOverrideProvider } from "@/components/layout/BreadcrumbOverrides"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="wide" />
      <main className="flex-1 py-4 md:py-6">
        <WideContainer>
          <Card className="mb-3 p-4" interactive padding={false}>
            <DashboardSearchChrome />
          </Card>
          <DashboardNavShell>
            <DashboardPageLayout>
              <BreadcrumbOverrideProvider>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <TrustStrip />
                  <Button
                    href="/pricing"
                    variant="gold"
                    size="sm"
                    className="shrink-0 shadow-sm"
                  >
                    Upgrade plan
                  </Button>
                </div>
                <Suspense fallback={null}>
                  <RouteBreadcrumbs />
                </Suspense>
                {children}
              </BreadcrumbOverrideProvider>
            </DashboardPageLayout>
          </DashboardNavShell>
        </WideContainer>
      </main>
      <SiteFooter variant="wide" />
    </div>
  )
}
