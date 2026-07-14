import { spacing } from "@/design-system/tokens"
import { requireAuth } from "@/lib/require-auth"
import { getQrDashboardPayload } from "@/lib/qr-identity-server-data"
import { QRIdentityManagementClient } from "@/components/dashboard/qr-identity/QRIdentityManagementClient"

export default async function QRIdentityAllPage() {
  const { user } = await requireAuth()
  const payload = await getQrDashboardPayload(user.id)

  return (
    <div className={spacing.pageStack}>
      <QRIdentityManagementClient initialData={payload} />
    </div>
  )
}
