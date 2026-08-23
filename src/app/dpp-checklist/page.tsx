import type { Metadata } from "next"
import { CheckCircle2, FileText, ShieldCheck } from "lucide-react"
import { DppChecklistForm } from "@/components/marketing/DppChecklistForm"
import { marketingLayout } from "@/components/marketing/marketingLayout"
import { siteUrl } from "@/lib/marketing"
import {
  DPP_CHECKLIST_FAQ,
  DPP_CHECKLIST_PHASES,
  ORIGINPASS_APP_LISTING_URL,
} from "@/lib/dpp-checklist-content"

const TITLE = "The EU Textile DPP Readiness Checklist (2026) | OriginPass"
const DESCRIPTION =
  "A free step-by-step EU DPP checklist to prepare for the Ecodesign for Sustainable Products Regulation (ESPR) before the textile Digital Product Passport deadline. Five phases, from scope to audit-readiness."

export async function generateMetadata(): Promise<Metadata> {
  const url = `${siteUrl()}/dpp-checklist`
  return {
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
      "EU DPP checklist",
      "textile digital product passport readiness",
      "ESPR compliance checklist",
      "EU Digital Product Passport",
      "textile DPP requirements",
    ],
    alternates: { canonical: url },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url,
      siteName: "OriginPass",
      locale: "en",
      type: "article",
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  }
}

/** FAQPage schema — mirrors the on-page Q&As exactly (required for rich results). */
function FaqJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: DPP_CHECKLIST_FAQ.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  }
  return (
    <script
      type="application/ld+json"
      // Server-rendered constant content — no user input is interpolated.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export default function DppChecklistPage() {
  return (
    <>
      <FaqJsonLd />

      <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <header className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Free checklist · PDF
          </span>
          <h1 className={`mt-5 ${marketingLayout.heroTitle}`}>
            The EU Textile DPP Readiness Checklist (2026)
          </h1>
          <p className={`mx-auto mt-4 max-w-2xl ${marketingLayout.body}`}>
            A free step-by-step checklist to prepare for the EU&apos;s Ecodesign for Sustainable Products
            Regulation (ESPR) before the textile Digital Product Passport deadline.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
            Compliance is expected to phase in from <strong className="font-semibold text-slate-700">2028</strong> —
            earlier for large brands, later for SMEs.
          </p>
        </header>

        {/* ── What's inside ──────────────────────────────────────────────── */}
        <section className="mt-12" aria-labelledby="whats-inside">
          <h2 id="whats-inside" className={marketingLayout.sectionTitle}>
            What&apos;s inside
          </h2>
          <p className={`mt-2 ${marketingLayout.body}`}>Five phases, in the order that avoids rework:</p>
          <ul className="mt-5 space-y-3">
            {DPP_CHECKLIST_PHASES.map((phase, index) => (
              <li key={phase.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-[15px] leading-relaxed text-slate-700">{phase.preview}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Email capture ──────────────────────────────────────────────── */}
        <section className="mt-12 scroll-mt-8" id="get-the-checklist" aria-labelledby="get-heading">
          <h2 id="get-heading" className={marketingLayout.sectionTitle}>
            Get the checklist
          </h2>
          <p className={`mt-2 mb-5 ${marketingLayout.body}`}>
            Enter your email and we&apos;ll send the PDF straight over.
          </p>
          <DppChecklistForm />
        </section>

        {/* ── Who it's for ───────────────────────────────────────────────── */}
        <section className="mt-14" aria-labelledby="who-for">
          <h2 id="who-for" className={marketingLayout.sectionTitle}>
            Who it&apos;s for
          </h2>
          <ul className="mt-4 space-y-2.5">
            {[
              "Fashion and textile brands selling into the EU — including brands based outside it.",
              "Suppliers and manufacturers being asked for material, origin, and certificate data.",
              "Importers and distributors placing textile products on the EU market.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <span className="text-[15px] leading-relaxed text-slate-700">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Soft app CTA ───────────────────────────────────────────────── */}
        <section className="mt-14 rounded-2xl border border-border bg-white/90 p-6 shadow-sm" aria-labelledby="app-cta">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-slate-900" aria-hidden />
            <div>
              <h2 id="app-cta" className="text-lg font-semibold text-slate-900">
                When you&apos;re ready to automate this
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                OriginPass generates verified, audit-ready passports inside Shopify — including attaching supplier
                evidence to each claim.
              </p>
              <a
                href={ORIGINPASS_APP_LISTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
              >
                View OriginPass on the Shopify App Store
              </a>
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="mt-14" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className={marketingLayout.sectionTitle}>
            Frequently asked questions
          </h2>
          <dl className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
            {DPP_CHECKLIST_FAQ.map((faq) => (
              <div key={faq.question} className="py-5">
                <dt className="text-[15px] font-semibold text-slate-900">{faq.question}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-slate-600">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-12 text-center text-xs leading-relaxed text-slate-500">
          General information about regulatory direction, not legal advice. ESPR delegated acts for textiles are still
          being finalised — confirm obligations for your category with a qualified compliance advisor.
        </p>
      </main>
    </>
  )
}
