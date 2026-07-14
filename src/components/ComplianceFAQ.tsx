import { ChevronDown, HelpCircle } from "lucide-react"

type FaqEntry = {
  question: string
  answer: string
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "Where do I find my material verification numbers?",
    answer:
      "These are found on your supplier's Global Organic Textile Standard (GOTS) or OEKO-TEX certificate records. Save them as a PDF and upload them inside our evidence panel to build an audit-ready trail.",
  },
  {
    question: "What do consumers see when they scan a label?",
    answer:
      "The public passport page: your brand name, production location, care instructions, material composition, and a verification section showing whether each claim has supporting evidence on file.",
  },
  {
    question: "What happens to my data if I uninstall the app?",
    answer:
      "Your access token is revoked immediately, and 48 hours after uninstall Shopify triggers a mandatory purge that removes your store's configuration and uploaded certificates.",
  },
]

/**
 * Compliance FAQ panel for the Shopify embedded dashboard.
 * Native `<details>` / `<summary>` (keyboard + screen-reader friendly).
 * Typography and borders use Polaris admin tokens.
 */
export function ComplianceFAQ() {
  return (
    <section
      aria-labelledby="compliance-faq-heading"
      className="rounded-xl border border-[#e3e3e3] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-[#6d7175]" aria-hidden />
        <h2 id="compliance-faq-heading" className="text-sm font-semibold text-[#202223]">
          Compliance FAQ
        </h2>
      </div>
      <div className="mt-3 divide-y divide-[#ebebeb]">
        {FAQ_ENTRIES.map((entry) => (
          <details key={entry.question} className="group py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-medium text-[#202223] transition-colors hover:text-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1 [&::-webkit-details-marker]:hidden">
              {entry.question}
              <ChevronDown
                className="h-4 w-4 shrink-0 text-[#8c9196] transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="mt-2 pr-7 text-sm leading-relaxed text-[#6d7175]">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
