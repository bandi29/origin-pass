/**
 * Build the downloadable EU Textile DPP Readiness Checklist PDF.
 *
 * Content comes from src/lib/dpp-checklist-content.ts so the PDF, the landing
 * page, and the FAQ schema can never drift apart.
 *
 * Run: npx tsx scripts/generate-dpp-checklist-pdf.mts
 * Out: public/downloads/eu-textile-dpp-readiness-checklist.pdf
 */
import { createElement as h } from "react"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
// Dynamic imports: under tsx, static named imports from these modules fail with
// "does not provide an export named ..." (ESM/CJS interop). Same workaround as
// demo/gen-hangtag.mts.
const {
  DPP_CHECKLIST_CLOSING,
  DPP_CHECKLIST_INTRO,
  DPP_CHECKLIST_PHASES,
  DPP_CHECKLIST_TITLE,
  ORIGINPASS_APP_LISTING_URL,
} = await import("@/lib/dpp-checklist-content")

const { Document, Page, Text, View, Link, StyleSheet, renderToBuffer } = await import("@react-pdf/renderer")

const INK = "#0f172a"
const MUTED = "#475569"
const RULE = "#e2e8f0"
const ACCENT = "#0c5132"

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 56, paddingHorizontal: 54, fontSize: 10.5, color: INK, lineHeight: 1.5 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 26 },
  brandMark: {
    width: 20, height: 20, borderRadius: 5, backgroundColor: INK, color: "#fff",
    fontSize: 11, fontWeight: 700, textAlign: "center", paddingTop: 4, marginRight: 8,
  },
  brandName: { fontSize: 11, fontWeight: 700, letterSpacing: 0.3 },
  eyebrow: { fontSize: 8.5, letterSpacing: 1.2, color: MUTED, textTransform: "uppercase", marginBottom: 8 },
  title: { fontSize: 21, fontWeight: 700, lineHeight: 1.25, marginBottom: 12 },
  intro: { fontSize: 10.5, color: MUTED, marginBottom: 20 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 20 },
  phaseBlock: { marginBottom: 18 },
  phaseHeading: { fontSize: 12.5, fontWeight: 700, marginBottom: 8 },
  item: { flexDirection: "row", marginBottom: 6, paddingRight: 6 },
  box: { width: 9, height: 9, borderWidth: 1, borderColor: "#94a3b8", borderRadius: 2, marginRight: 8, marginTop: 2.5 },
  itemText: { flex: 1, fontSize: 10, color: INK },
  ctaBox: { marginTop: 8, padding: 14, borderWidth: 1, borderColor: RULE, borderRadius: 8, backgroundColor: "#f8fafc" },
  ctaText: { fontSize: 10.5, color: INK, marginBottom: 6 },
  ctaLink: { fontSize: 10.5, color: ACCENT, textDecoration: "none", fontWeight: 700 },
  footer: {
    position: "absolute", bottom: 28, left: 54, right: 54, flexDirection: "row",
    justifyContent: "space-between", fontSize: 8, color: "#94a3b8",
    borderTopWidth: 1, borderTopColor: RULE, paddingTop: 8,
  },
  disclaimer: { marginTop: 16, fontSize: 8.5, color: "#94a3b8", lineHeight: 1.45 },
})

const doc = h(
  Document,
  { title: DPP_CHECKLIST_TITLE, author: "OriginPass", subject: "EU ESPR / Digital Product Passport readiness" },
  h(
    Page,
    { size: "A4", style: s.page },
    h(
      View,
      { style: s.brandRow },
      h(Text, { style: s.brandMark }, "O"),
      h(Text, { style: s.brandName }, "OriginPass"),
    ),
    h(Text, { style: s.eyebrow }, "Readiness Checklist"),
    h(Text, { style: s.title }, DPP_CHECKLIST_TITLE),
    h(Text, { style: s.intro }, DPP_CHECKLIST_INTRO),
    h(View, { style: s.rule }),

    ...DPP_CHECKLIST_PHASES.map((phase) =>
      h(
        View,
        { key: phase.id, style: s.phaseBlock, wrap: false },
        h(Text, { style: s.phaseHeading }, phase.heading),
        ...phase.items.map((item, i) =>
          h(
            View,
            { key: `${phase.id}-${i}`, style: s.item },
            h(View, { style: s.box }),
            h(Text, { style: s.itemText }, item),
          ),
        ),
      ),
    ),

    h(
      View,
      { style: s.ctaBox, wrap: false },
      h(Text, { style: s.ctaText }, DPP_CHECKLIST_CLOSING),
      h(Link, { src: ORIGINPASS_APP_LISTING_URL, style: s.ctaLink }, "Get OriginPass on the Shopify App Store →"),
    ),

    h(
      Text,
      { style: s.disclaimer },
      "General information about regulatory direction, not legal advice. ESPR delegated acts for textiles are still being finalised — confirm obligations for your category with a qualified compliance advisor.",
    ),

    h(
      View,
      { style: s.footer, fixed: true },
      h(Text, {}, "OriginPass · EU Textile DPP Readiness Checklist"),
      h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` }),
    ),
  ),
)

const outDir = path.resolve("public/downloads")
mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, "eu-textile-dpp-readiness-checklist.pdf")
const buffer = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0])
writeFileSync(outFile, buffer)
console.log(`PDF written: ${outFile} (${(buffer.length / 1024).toFixed(0)} KB)`)
