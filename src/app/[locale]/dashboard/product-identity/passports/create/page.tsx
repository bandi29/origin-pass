import { spacing } from "@/design-system/tokens"
import { CreatePassportForm } from "@/components/passports/CreatePassportForm"
import { getProductsForUser } from "@/lib/passports-data"
import { PageHeader } from "@/components/layout/PageHeader"

export default async function CreatePassportPage() {
  const products = await getProductsForUser()

  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Create passport"
        description="Generate a new digital product passport in under 60 seconds."
        contextBadge="Product · Passports"
      />

      <CreatePassportForm products={products} />
    </div>
  )
}
