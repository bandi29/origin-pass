import type { PassportActivityLogEntry } from "@/lib/passport-activity-types"

type PassportActivityLogTemplate = Omit<PassportActivityLogEntry, "occurredAt" | "isDemo"> & {
  /** Milliseconds before `nowMs` (negative = past). */
  offsetMs: number
}

/** Fictional preview rows — never treated as organization activity. */
const DEMO_ACTIVITY_LOG_TEMPLATES: PassportActivityLogTemplate[] = [
  {
    id: "demo-001",
    eventType: "QR_SCANNED",
    description: "Consumer scanned QR code for OP-14630191A4D7 from Paris, France.",
    targetLabel: "OP-14630191A4D7",
    targetHref: "/verify/OP-14630191A4D7",
    offsetMs: -2 * 60 * 1000,
  },
  {
    id: "demo-002",
    eventType: "PASSPORT_CREATED",
    description: "Digital passport issued for Linen Tote Bag — batch AW-26.",
    targetLabel: "Linen Tote Bag",
    targetHref: "/dashboard/product-passports",
    offsetMs: -18 * 60 * 1000,
  },
  {
    id: "demo-003",
    eventType: "OWNERSHIP_CLAIMED",
    description: "Consumer registered secure ownership and activated warranty vault.",
    targetLabel: "OP-88219F3A2B01",
    targetHref: "/verify/OP-88219F3A2B01",
    offsetMs: -45 * 60 * 1000,
  },
  {
    id: "demo-004",
    eventType: "METADATA_UPDATED",
    eventTitle: "Product updated",
    description: "EUDR geo-coordinates updated for Heritage Leather Weekender compliance record.",
    targetLabel: "Heritage Leather Weekender",
    targetHref: "/dashboard/products",
    offsetMs: -2 * 60 * 60 * 1000,
  },
  {
    id: "demo-005",
    eventType: "QR_SCANNED",
    description: "Consumer scanned QR code for OP-7734C91E0F22 from Milan, Italy.",
    targetLabel: "OP-7734C91E0F22",
    targetHref: "/verify/OP-7734C91E0F22",
    offsetMs: -3 * 60 * 60 * 1000,
  },
  {
    id: "demo-006",
    eventType: "PASSPORT_CREATED",
    description: "Batch AW-26 imported successfully via Excel — 22 passports generated.",
    targetLabel: "Batch AW-26",
    targetHref: "/dashboard/product-passports",
    offsetMs: -5 * 60 * 60 * 1000,
  },
]

/** Example headline metrics shown only in the demo preview block. */
export const DEMO_ACTIVITY_SUMMARY = {
  totalScans: 1248,
  scansTrendLabel: "+12% this week",
  passportsGenerated: 22,
  ownershipClaims: 14,
} as const

export function buildDemoPassportActivityLogs(nowMs = Date.now()): PassportActivityLogEntry[] {
  return DEMO_ACTIVITY_LOG_TEMPLATES.map(({ offsetMs, ...rest }) => ({
    ...rest,
    occurredAt: new Date(nowMs + offsetMs).toISOString(),
    isDemo: true,
  })).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )
}
