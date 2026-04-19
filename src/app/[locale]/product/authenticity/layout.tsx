import { spacing } from "@/design-system/tokens"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { ProductAreaBreadcrumbs } from "@/components/layout/ProductAreaBreadcrumbs"
import { FadeIn } from "@/components/layout/FadeIn"

export default async function AuthenticityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
          <ProductAreaBreadcrumbs />
          <FadeIn className={spacing.pageStack}>{children}</FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
