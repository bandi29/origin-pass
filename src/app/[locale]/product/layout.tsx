import { requireAuth } from "@/lib/require-auth"

export default async function ProductRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth({ requireOrganization: true })
  return <>{children}</>
}
