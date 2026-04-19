import { AuthenticitySubNav } from "@/components/authenticity/AuthenticitySubNav"

export default function DashboardAuthenticityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <AuthenticitySubNav />
      {children}
    </div>
  )
}
