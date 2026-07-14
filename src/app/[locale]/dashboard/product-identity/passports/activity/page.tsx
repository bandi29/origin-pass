import { spacing } from "@/design-system/tokens"
import { PageHeader } from "@/components/layout/PageHeader"
import { PassportActivityClient } from "@/components/passports/PassportActivityClient"
import { getPassportActivityForUser } from "@/lib/passport-activity-server"
import { createClient } from "@/lib/supabase/server"

const EMPTY_SUMMARY = {
  totalScans: 0,
  passportsGenerated: 0,
  ownershipClaims: 0,
  scansTrendLabel: null,
} as const

export default async function PassportActivityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const activity = user
    ? await getPassportActivityForUser(user.id)
    : { summary: EMPTY_SUMMARY, logs: [] }

  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Passport activity"
        description="Review recent passport creation and update activity."
        contextBadge="Product · Passports"
      />
      <PassportActivityClient liveSummary={activity.summary} liveLogs={activity.logs} />
    </div>
  )
}
