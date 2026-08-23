/**
 * Single source of truth for the EU Textile DPP Readiness Checklist lead magnet.
 *
 * Consumed by:
 *  - the /dpp-checklist landing page (on-page copy + FAQ)
 *  - the FAQPage JSON-LD block on that page
 *  - scripts/generate-dpp-checklist-pdf.mts (the downloadable PDF)
 *
 * Keeping one module means the page, the schema, and the PDF can never drift.
 */

export const DPP_CHECKLIST_TAG = "dpp-checklist"

export const DPP_CHECKLIST_PDF_PATH = "/downloads/eu-textile-dpp-readiness-checklist.pdf"

export const DPP_CHECKLIST_TITLE = "EU Textile Digital Product Passport — Readiness Checklist"

export const DPP_CHECKLIST_INTRO =
  "The EU's Ecodesign for Sustainable Products Regulation (ESPR) will require Digital Product Passports for textiles and apparel. The delegated act is expected around 2027, with mandatory compliance phasing in from 2028 — earlier for larger brands, later for SMEs. The longest-lead-time task is collecting and verifying data from your suppliers, so starting now is the advantage."

export const DPP_CHECKLIST_CLOSING =
  "When you're ready to generate real, verified passports from this data, OriginPass automates it inside Shopify — including attaching supplier evidence to each claim."

export type ChecklistPhase = {
  id: string
  /** "Phase 1 — Confirm scope" */
  heading: string
  /** Short label used in the on-page "What's inside" preview. */
  preview: string
  items: string[]
}

export const DPP_CHECKLIST_PHASES: ChecklistPhase[] = [
  {
    id: "scope",
    heading: "Phase 1 — Confirm scope",
    preview: "Confirm scope — whether the rules apply to you, and when",
    items: [
      "Confirm you sell physical textile/apparel products into the EU (applies to non-EU brands too).",
      "Identify which product categories are likely in the first textile delegated act.",
      "Check overlapping regulations (EUDR for leather, Battery Regulation for electronic accessories).",
      "Note the expected timeline for your business size (large brands ~2027–2028, SMEs ~2028–2029).",
    ],
  },
  {
    id: "inventory",
    heading: "Phase 2 — Inventory your product data",
    preview: "Inventory your product data — what you hold vs. what's missing",
    items: [
      "List every data field you already hold per product (composition, origin, care).",
      "Identify gaps against expected DPP fields: fibre composition & percentages, recycled content % and feedstock origin, country of manufacturing per production step, durability information, substances of concern.",
      "Flag which data you have vs. which must come from suppliers.",
    ],
  },
  {
    id: "suppliers",
    heading: "Phase 3 — Collect supplier data (the long pole)",
    preview: "Collect supplier data — the longest-lead-time task, start here",
    items: [
      "Map your tier 1–4 suppliers for each product.",
      "Request material certificates, recycled-content proof, and manufacturing-origin documentation from each supplier.",
      "Decide how you'll store the evidence behind each claim (this is what makes a passport audit-ready vs. just a data page).",
      "Set a recurring process — regulatory substance lists update, and suppliers change.",
    ],
  },
  {
    id: "carrier",
    heading: "Phase 4 — Plan the technical carrier",
    preview: "Plan the technical carrier — QR codes, identifiers, build vs. buy",
    items: [
      "Decide your data carrier (QR code is standard) and where it lives (product, label, or packaging).",
      "Ensure the identifier is persistent and the passport stays accessible over the product's life.",
      "Decide build-vs-buy: in-house infrastructure vs. a purpose-built DPP platform.",
    ],
  },
  {
    id: "accuracy",
    heading: "Phase 5 — Keep it accurate",
    preview: "Keep it accurate — re-verification and staying audit-ready",
    items: [
      "Treat DPP as an ongoing process, not a one-time project.",
      "Re-verify supplier data on a schedule.",
      "Keep evidence attached to each claim so you can respond to a market-surveillance request.",
    ],
  },
]

export type ChecklistFaq = { question: string; answer: string }

export const DPP_CHECKLIST_FAQ: ChecklistFaq[] = [
  {
    question: "When is the EU textile DPP deadline?",
    answer:
      "The textile delegated act is expected around 2027, with mandatory compliance phasing in from 2028 — earlier for large brands, later for SMEs. Timelines can shift, so treat these as planning dates.",
  },
  {
    question: "Does this apply to non-EU brands?",
    answer:
      "Yes. If you place physical textile products on the EU market, the requirement applies regardless of where your business is based.",
  },
  {
    question: "What data does a DPP require?",
    answer:
      "Expected fields include fibre composition, recycled content, country of manufacturing per step, durability, and substances of concern — much of it sourced from your suppliers.",
  },
  {
    question: "Is a spreadsheet enough?",
    answer:
      "A spreadsheet helps for early data inventory, but it breaks down when you need evidence attached to each claim and data access restricted by tier. That's where a purpose-built passport tool becomes necessary.",
  },
  {
    question: 'How do I make a passport "audit-ready"?',
    answer:
      "Attach supporting evidence (supplier certificates, test documents) to each data claim, and keep it current — so you can prove what the passport states if a regulator asks.",
  },
]

/** Shopify App Store listing. Update if the public handle differs at launch. */
export const ORIGINPASS_APP_LISTING_URL = "https://apps.shopify.com/originpass"
