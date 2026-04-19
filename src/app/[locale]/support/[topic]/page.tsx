import { spacing } from "@/design-system/tokens"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { notFound } from "next/navigation"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const supportTopics: Record<string, { title: string; body: string }> = {
  "help-center": {
    title: "Help Center",
    body: "Browse setup, QR printing, verification, and compliance guides.",
  },
  "contact-support": {
    title: "Contact Support",
    body: "Reach the OriginPass team for onboarding or technical help.",
  },
  "system-status": {
    title: "System Status",
    body: "Track API, dashboard, and scan verification uptime.",
  },
}

export default async function SupportTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>
}) {
  const { topic } = await params
  const page = supportTopics[topic]
  if (!page) notFound()

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
          <SimplePageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Support", href: "/support" },
              { label: page.title },
            ]}
          />
          <FadeIn className="space-y-4">
            <PageHeader title={page.title} description={page.body} />
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
