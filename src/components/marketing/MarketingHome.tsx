import type { SVGProps } from "react"
import { Link } from "@/i18n/navigation"
import { ArrowRight, Check, Leaf, Package, Sparkles } from "lucide-react"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { HeroPassportTransformation } from "@/components/marketing/HeroPassportTransformation"
import { HomeProductShowcase } from "@/components/marketing/HomeProductShowcase"
import {
  MARKETING_PASSPORT_PREVIEW_DEMO,
  PassportPagePreviewCard,
} from "@/components/passports/PassportPagePreviewCard"
import {
  marketingBandStack,
  marketingContentColumn,
  marketingIconBoxClass,
  marketingLayout,
} from "@/components/marketing/marketingLayout"
import { marketingSection } from "@/components/marketing/marketingSection"
import { Button } from "@/components/ui/Button"
import { Section } from "@/components/ui/Section"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { demoVerifyHref } from "@/lib/marketing"
import { SAFE_PRIMARY_BG } from "@/lib/safe-cta-surface"
import { twMerge } from "tailwind-merge"

function HammerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      {...props}
    >
      <path d="M15 12l-8.5 8.5a2.12 2.12 0 01-3-3L12 9" />
      <path d="M17.64 15L22 10.64" />
      <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-3.86a2 2 0 00-2-2h-3.86c-.85 0-1.65.33-2.25.93L3.6 15.93c-.62.62-.96 1.45-.96 2.34V21h4.73c.9 0 1.72-.34 2.34-.96L19.07 12" />
    </svg>
  )
}

const valueProps = [
  "Build customer trust",
  "Fight counterfeits",
  "Track ownership history",
  "Share product stories",
  "Gain customer insights",
]

const useCases = [
  {
    title: "Artisans",
    body: "Prove craft, workshop, and small-batch authenticity without enterprise tooling.",
    icon: HammerIcon,
    tone: "blue" as const,
  },
  {
    title: "D2C brands",
    body: "Turn every shipment into a trust moment with scannable proof at checkout.",
    icon: Package,
    tone: "purple" as const,
  },
  {
    title: "Luxury goods",
    body: "Protect premium positioning with ownership-ready records and clear provenance.",
    icon: Sparkles,
    tone: "emerald" as const,
  },
  {
    title: "Sustainable products",
    body: "Back materials and lifecycle claims customers can verify in one scan.",
    icon: Leaf,
    tone: "green" as const,
  },
] as const

const steps = [
  { step: "1", title: "Create product", body: "Add product details, origin, materials, and story in a guided flow." },
  { step: "2", title: "Generate passport", body: "Issue a unique passport and QR for each product or batch." },
  { step: "3", title: "Share via QR", body: "Print or embed codes; customers verify in one scan on any phone." },
] as const

export function MarketingHome() {
  const demoHref = demoVerifyHref()

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white">
      <SiteHeader variant="narrow" />

      <main className="flex min-w-0 flex-1 flex-col gap-y-0 [-webkit-text-size-adjust:100%] [text-size-adjust:100%]">
        <section className="marketing-hero-section bg-white pt-20 pb-10">
          <div className="marketing-container">
            <div className="flex w-full flex-col gap-6">
              <div className="hero-container grid min-h-[500px] w-full grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
                <div className="hero-left flex h-full min-w-0 flex-col justify-center">
                  <div className={marketingLayout.heroCopy}>
                    <div className="flex flex-col gap-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600/80">
                        Digital Product Passport · Traceability SaaS
                      </p>
                      <h1 className="marketing-hero-title leading-[1.1] tracking-tight">
                        Build trust into <br className="hidden lg:block" /> every product
                      </h1>
                      <p className="marketing-hero-lead max-w-lg text-lg leading-relaxed text-gray-600">
                        Create machine-readable product passports ready for July 2026 EU regulations.
                        Track origin, ownership, and authenticity in one scan.
                      </p>
                    </div>
                    <div className="relative mx-auto mt-6 w-full max-w-xl lg:mx-0 lg:mt-2">
                      <HeroPassportTransformation />
                    </div>
                    <div className="cta-row mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                      <Button
                        href="/signup"
                        variant="primary"
                        size="lg"
                        className="w-full px-8 shadow-lg shadow-gray-200 sm:w-auto"
                      >
                        Get started free
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                      </Button>
                      <Button href={demoHref} variant="secondary" size="lg" className="w-full sm:w-auto">
                        View demo
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="hero-right flex h-full w-full items-center justify-center lg:justify-end">
                  <PassportPagePreviewCard
                    productName={MARKETING_PASSPORT_PREVIEW_DEMO.productName}
                    subtitle={MARKETING_PASSPORT_PREVIEW_DEMO.subtitle}
                    productStory={MARKETING_PASSPORT_PREVIEW_DEMO.productStory}
                    materials={MARKETING_PASSPORT_PREVIEW_DEMO.materials}
                    showStructuredDataTags
                    scanHint={MARKETING_PASSPORT_PREVIEW_DEMO.scanHint}
                    interactiveHover
                  />
                </div>
              </div>

              <ul className="trust-row m-0 mt-6 flex list-none flex-col items-center gap-6 p-0 text-sm font-medium text-gray-500 sm:flex-row sm:justify-center lg:justify-start">
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  No credit card required
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  Setup in 2 min
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  Free forever plan
                </li>
              </ul>
            </div>
          </div>
        </section>

        <Section id="how-it-works" alt>
          <div className="flex w-full flex-col gap-10 md:gap-14">
            <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-3 text-center md:pb-4">
              <h2 className="text-3xl font-semibold tracking-tight text-gray-900">How it works</h2>
              <p className="text-gray-600">Three steps from catalog to customer trust.</p>
            </div>
            <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className={`${marketingSection.card} flex flex-col`}>
                  <p className={marketingLayout.label}>Step {item.step}</p>
                  <h3 className="mt-2 text-lg font-bold text-black">{item.title}</h3>
                  <p className={`mt-2 flex-1 max-w-2xl ${marketingLayout.body}`}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section>
          <div className={twMerge(marketingContentColumn, marketingBandStack)}>
            <SectionHeader
              variant="marketing"
              title="Product showcase"
              description="Passport page, QR scan experience, and analytics — the same surfaces your team and customers see."
            />
            <HomeProductShowcase />
          </div>
        </Section>

        <Section alt>
          <div className={twMerge(marketingContentColumn, marketingBandStack)}>
            <SectionHeader
              variant="marketing"
              title="Why teams choose OriginPass"
              description="Clarity for customers. Control for your brand. Proof you can scale."
            />
            <div className="grid w-full grid-cols-1 gap-8 text-center md:grid-cols-3 md:text-left">
            {valueProps.map((label) => (
              <div
                key={label}
                className="flex items-start justify-center gap-3 md:justify-start"
              >
                <Check className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5 transition-transform duration-200 ease-out hover:scale-110" aria-hidden />
                <p className="text-[16px] font-medium leading-[26px] text-black">{label}</p>
              </div>
            ))}
            </div>
          </div>
        </Section>

        <Section>
          <div className={twMerge(marketingContentColumn, marketingBandStack)}>
            <SectionHeader
              variant="marketing"
              title="Built for high-trust categories"
              description="From workshop to warehouse, one passport layer for proof and storytelling."
            />
            <div className="grid w-full grid-cols-1 gap-8 text-center md:grid-cols-2 md:text-left">
            {useCases.map((u) => (
              <div key={u.title} className={`${marketingSection.card} flex flex-col`}>
                <div className="flex gap-4 justify-center md:justify-start">
                  <div className={marketingIconBoxClass(u.tone)}>
                    <u.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black">{u.title}</h3>
                    <p className={`mt-2 max-w-2xl ${marketingLayout.body}`}>{u.body}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        </Section>

        <Section alt>
          <div className={marketingContentColumn}>
            <div
              className="rounded-3xl px-6 py-12 text-center text-white shadow-lg md:px-12 md:py-16"
              style={{ backgroundColor: SAFE_PRIMARY_BG }}
              aria-labelledby="marketing-social-proof-heading"
            >
              <p
                id="marketing-social-proof-heading"
                className="text-lg font-bold text-white md:text-xl"
              >
                Loved by early-stage brands
              </p>
              <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-[26px] text-gray-300">
                We are shipping with artisans and D2C teams who need trust without complexity.
              </p>
            </div>
          </div>
        </Section>

        <Section>
          <div className={twMerge(marketingContentColumn, marketingBandStack)}>
            <SectionHeader
              variant="marketing"
              title="Simple, transparent pricing"
              description="Start free. Upgrade when you need analytics, AI story tools, and team features."
            />
            <div className="flex justify-center">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-all duration-200 ease-out hover:text-black active:scale-95"
              >
                View pricing
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </Section>

        <Section alt>
          <div className={marketingContentColumn}>
            <div className="rounded-3xl bg-gray-50 px-6 py-12 transition-shadow duration-200 md:px-12 md:py-16">
              <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
                <h2 className={marketingLayout.sectionTitle}>
                  Start building product trust today
                </h2>
                <p className="max-w-2xl mx-auto text-center text-[16px] leading-[26px] text-gray-600">
                  No credit card. Takes about two minutes. Keep a free tier as long as you need it.
                </p>
                <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
                  <Button href="/signup" variant="primary" size="lg" className="w-full sm:w-auto">
                    Get started free
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button href={demoHref} variant="secondary" size="lg" className="w-full sm:w-auto">
                    View demo passport
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </main>

      <SiteFooter variant="narrow" />
    </div>
  )
}
