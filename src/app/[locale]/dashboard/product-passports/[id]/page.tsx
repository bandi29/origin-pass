import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isValidUuid } from "@/lib/security"
import { loadPassportDetailForUser } from "@/lib/passport-detail-server"
import { PassportDetailView } from "@/components/passports/PassportDetailView"
import { PassportSectionView } from "@/components/passports/PassportSectionView"

type PageProps = {
  params: Promise<{ id: string }>
}

/**
 * Single-segment route under /dashboard/product-passports/. Because a dynamic
 * `[id]` segment shadows the sibling `[...section]` catch-all, this route must
 * resolve both shapes:
 *   • a passport UUID  → the detail / public-layout preview
 *   • a known section  → the module sub-section (delegated to the shared view)
 *   • anything else    → 404
 */
export default async function PassportDetailPage({ params }: PageProps) {
  const { id } = await params

  if (!isValidUuid(id)) {
    return <PassportSectionView sectionKey={id} />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const payload = await loadPassportDetailForUser(user.id, id)
  if (!payload) notFound()

  return (
    <PassportDetailView
      passport={payload.passport}
      content={payload.content}
      scans={payload.scans}
      defaultTab="overview"
      baseUrl={payload.baseUrl}
      verificationComplianceStatus={payload.verificationComplianceStatus}
      verificationHistory={payload.verificationHistory}
      mode="view"
      esprScore={payload.esprScore}
    />
  )
}
