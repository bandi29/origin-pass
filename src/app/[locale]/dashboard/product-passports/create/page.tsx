import { spacing } from "@/design-system/tokens"
import { CreatePassportForm } from "@/components/passports/CreatePassportForm"
import { getProductsForUser } from "@/lib/passports-data"
import { PageHeader } from "@/components/layout/PageHeader"

export default async function DashboardCreatePassportPage({
  searchParams,
}: {
  searchParams: Promise<{ context?: string }>
}) {
  const products = await getProductsForUser()
  const sp = await searchParams
  const fromQrIdentity = sp.context === "qr-identity"

  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Create passport"
        description="Generate a new digital product passport in under 60 seconds."
        contextBadge={fromQrIdentity ? "Dashboard · QR Identity" : "Dashboard · Passports"}
      />

      <CreatePassportForm
        products={products}
        createAnotherHref={
          fromQrIdentity ? "/dashboard/product-passports/create?context=qr-identity" : "/dashboard/product-passports/create"
        }
      />
    </div>
  )
}
