import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Plus } from "lucide-react"
import { getPassportsForUser } from "@/lib/passports-data"
import { PassportListWithSearch } from "@/components/passports/PassportListWithSearch"
import { PageHeader } from "@/components/layout/PageHeader"

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

const primaryBtn =
  "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"

export default async function PassportsListPage() {
  const passports = await getPassportsForUser()

  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Digital Product Passports"
        description="Create and manage digital passports for your products."
        contextBadge="Product · Passports"
        actions={
          <Link href="/product/passports/create" className={primaryBtn}>
            <Plus className="h-4 w-4" />
            Create passport
          </Link>
        }
      />

      <PassportListWithSearch
        passports={passports}
        baseUrl={baseUrl}
        actions={
          <div className="flex gap-2 sm:flex-shrink-0">
            <Link
              href="/product/passports/templates"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Templates
            </Link>
            <Link
              href="/product/passports/activity"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Activity
            </Link>
          </div>
        }
      />
    </div>
  )
}
