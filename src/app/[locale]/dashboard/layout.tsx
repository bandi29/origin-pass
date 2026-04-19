import { AppShell } from "@/components/layout/AppShell"
import { requireAuth } from "@/lib/require-auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth({ requireOrganization: true })

  return <AppShell>{children}</AppShell>
}
