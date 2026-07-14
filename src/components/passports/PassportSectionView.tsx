import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"
import { PassportActivityClient } from "@/components/passports/PassportActivityClient"
import { getPassportActivityForUser } from "@/lib/passport-activity-server"
import { createClient } from "@/lib/supabase/server"

const EMPTY_SUMMARY = {
  totalScans: 0,
  passportsGenerated: 0,
  ownershipClaims: 0,
  scansTrendLabel: null,
} as const

/** Known passport sub-section keys served under /dashboard/product-passports/<key>. */
export const PASSPORT_SECTIONS: Record<string, string> = {
  "all-passports": "Browse and manage all passports for your organization.",
  "create-passport": "Create a new passport with product and verification metadata.",
  "passport-templates": "Manage reusable passport templates by product category.",
  "passport-activity": "Review recent passport creation and update activity.",
}

export function isPassportSectionKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(PASSPORT_SECTIONS, key)
}

/**
 * Renders a passport module sub-section by key. Shared by the `[...section]`
 * catch-all and the `[id]` route (which now shadows single-segment paths once a
 * concrete detail page exists), so both resolve the same content. Unknown keys
 * 404 exactly as before.
 */
export async function PassportSectionView({ sectionKey }: { sectionKey: string }) {
  if (!isPassportSectionKey(sectionKey)) notFound()

  if (sectionKey === "passport-activity") {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const activity = user
      ? await getPassportActivityForUser(user.id)
      : { summary: EMPTY_SUMMARY, logs: [] }

    return (
      <div className={spacing.pageStack}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Passports: passport activity</h1>
          <p className="mt-2 text-slate-600">{PASSPORT_SECTIONS[sectionKey]}</p>
        </div>
        <PassportActivityClient liveSummary={activity.summary} liveLogs={activity.logs} />
      </div>
    )
  }

  return (
    <div className={spacing.pageStack}>
      <h1 className="text-3xl font-bold text-slate-900">Passports: {sectionKey.replace(/-/g, " ")}</h1>
      <p className="text-slate-600">{PASSPORT_SECTIONS[sectionKey]}</p>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        Passports module placeholder.
      </div>
    </div>
  )
}
