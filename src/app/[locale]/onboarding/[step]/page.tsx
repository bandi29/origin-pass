import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { notFound } from "next/navigation"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const steps: Record<string, { title: string; helper: string; next?: string }> = {
  "create-organization": {
    title: "Create Organization",
    helper: "Set company name, workspace, and country to initialize your account.",
    next: "/onboarding/add-brand-details",
  },
  "add-brand-details": {
    title: "Add Brand Details",
    helper: "Upload logo, brand story, and trust details visible on scan pages.",
    next: "/onboarding/create-first-product",
  },
  "create-first-product": {
    title: "Create First Product",
    helper: "Add product name, origin, materials, and core craftsmanship info.",
    next: "/onboarding/generate-first-passport",
  },
  "generate-first-passport": {
    title: "Generate First Passport",
    helper: "Generate QR code, preview verification page, and publish your first trust passport.",
  },
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>
}) {
  const { step } = await params
  const page = steps[step]
  if (!page) notFound()

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-xl ${spacing.pageStack}`}>
          <SimplePageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Onboarding", href: "/onboarding" },
              { label: page.title },
            ]}
          />
          <FadeIn className={spacing.pageStack}>
            <PageHeader title={page.title} description={page.helper} contextBadge="Setup" />
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">UI placeholder for this onboarding step.</p>
            </div>
            {page.next ? (
              <Link
                href={page.next}
                className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Continue
              </Link>
            ) : null}
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
