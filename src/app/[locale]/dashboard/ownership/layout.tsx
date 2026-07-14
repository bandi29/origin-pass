import { spacing } from "@/design-system/tokens"
import { PageHeader } from "@/components/layout/PageHeader"
import { OwnershipSubNav } from "@/components/ownership/OwnershipSubNav"

export default function OwnershipLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Ownership Hub"
        description="Track post-purchase ownership and warranty journeys."
        contextBadge="Operations · Ownership Hub"
      />
      <OwnershipSubNav />
      {children}
    </div>
  )
}
