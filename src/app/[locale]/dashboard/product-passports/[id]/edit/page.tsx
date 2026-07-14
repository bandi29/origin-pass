import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadPassportDetailForUser } from "@/lib/passport-detail-server"
import { PassportDetailView } from "@/components/passports/PassportDetailView"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function PassportEditPage({ params }: PageProps) {
  const { id: passportId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const payload = await loadPassportDetailForUser(user.id, passportId)
  if (!payload) notFound()

  return (
    <PassportDetailView
      passport={payload.passport}
      content={payload.content}
      scans={payload.scans}
      defaultTab="content"
      baseUrl={payload.baseUrl}
      verificationComplianceStatus={payload.verificationComplianceStatus}
      verificationHistory={payload.verificationHistory}
      mode="edit"
    />
  )
}
