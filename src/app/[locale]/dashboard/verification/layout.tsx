import { VerificationSubNav } from "@/components/authenticity/VerificationSubNav"

export default function DashboardVerificationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <VerificationSubNav />
      {children}
    </div>
  )
}
