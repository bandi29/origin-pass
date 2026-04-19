import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-ds-bg">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-3xl ${spacing.stackDense}`}>
          <h1 className="text-3xl font-bold text-ds-text">Privacy</h1>
          <p className="text-sm text-ds-text-muted leading-relaxed">
            We are preparing a detailed privacy policy for OriginPass. For questions about data
            handling, use{" "}
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
