import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-ds-bg">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-3xl ${spacing.stackDense}`}>
          <h1 className="text-3xl font-bold text-ds-text">Terms of service</h1>
          <p className="text-sm text-ds-text-muted leading-relaxed">
            Terms of service for OriginPass are being finalized. If you need a copy for procurement
            or legal review, contact us via{" "}
            <Link href="/support" className="text-ds-secondary hover:underline">
              support
            </Link>
            .
          </p>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
