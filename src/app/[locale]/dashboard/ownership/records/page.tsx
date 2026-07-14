import { OwnershipRecordsClient } from "@/components/ownership/OwnershipRecordsClient"
import { getOwnershipRecordsForUser } from "@/lib/ownership-records-server"
import { requireAuth } from "@/lib/require-auth"

export default async function OwnershipRecordsPage() {
  const { user } = await requireAuth()
  const rows = await getOwnershipRecordsForUser(user.id)
  return <OwnershipRecordsClient initialRows={rows} />
}
