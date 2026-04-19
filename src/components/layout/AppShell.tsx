import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { WideContainer } from "@/components/layout/Containers"
import DashboardSidebar from "@/components/dashboard/DashboardSidebar"
import RouteBreadcrumbs from "@/components/layout/RouteBreadcrumbs"
import { DashboardPageLayout } from "@/components/ui/DashboardPageLayout"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { TrustStrip } from "@/components/saas/TrustStrip"
import { Bell, CircleHelp, Search } from "lucide-react"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="wide" />
      <main className="flex-1 py-8 md:py-10">
        <WideContainer>
          <Card className="mb-4 p-4" interactive padding={false}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <Input
                  type="search"
                  name="dashboard-search"
                  placeholder="Search passports, scans, products..."
                  className="border-border bg-slate-50 pl-9 focus:bg-white"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-muted transition-all duration-200 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" aria-hidden />
                  Notifications
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-muted transition-all duration-200 hover:bg-slate-50"
                >
                  <CircleHelp className="h-4 w-4" aria-hidden />
                  Help
                </button>
              </div>
            </div>
          </Card>
          <div className="flex gap-8">
            <DashboardSidebar />
            <div className="min-w-0 flex-1">
              <DashboardPageLayout className="!py-0">
                <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <TrustStrip />
                  <Button
                    href="/pricing"
                    variant="primary"
                    size="sm"
                    className="shrink-0 shadow-sm"
                  >
                    Upgrade plan
                  </Button>
                </div>
                <RouteBreadcrumbs />
                {children}
              </DashboardPageLayout>
            </div>
          </div>
        </WideContainer>
      </main>
      <SiteFooter variant="wide" />
    </div>
  )
}
