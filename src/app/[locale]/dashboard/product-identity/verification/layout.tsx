import { VerificationSubNav } from "@/components/authenticity/VerificationSubNav"

export default function ProductIdentityVerificationLayout({
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
