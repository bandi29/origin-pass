import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getLabelPrintStudioPayload } from "@/lib/label-print-studio-server-data"
import { PrintLabelsStudioClient } from "@/components/dashboard/qr-identity/PrintLabelsStudioClient"

export default function QRIdentityPrintPage() {
  return <QRIdentityPrintPageContent />
}

async function QRIdentityPrintPageContent() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const payload = await getLabelPrintStudioPayload(user.id)

  return (
    <Suspense fallback={null}>
      <PrintLabelsStudioClient payload={payload} />
    </Suspense>
  )
}
