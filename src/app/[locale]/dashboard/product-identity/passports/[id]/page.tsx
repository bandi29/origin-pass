import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadPassportDetailForUser } from "@/lib/passport-detail-server"
import { PassportDetailView } from "@/components/passports/PassportDetailView"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function PassportDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id: passport_id } = await params
  const { tab } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const payload = await loadPassportDetailForUser(user.id, passport_id)
  if (!payload) notFound()

  return (
    <PassportDetailView
      passport={payload.passport}
      content={payload.content}
      scans={payload.scans}
      defaultTab={tab ?? "overview"}
      baseUrl={payload.baseUrl}
      verificationComplianceStatus={payload.verificationComplianceStatus}
      verificationHistory={payload.verificationHistory}
    />
  )
}
