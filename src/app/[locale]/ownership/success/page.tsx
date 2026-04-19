import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { CheckCircle2 } from "lucide-react"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"

export default function OwnershipSuccessPage() {
  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${spacing.main}`}>
      <NarrowContainer className="max-w-6xl">
        <div className={`mx-auto max-w-md ${spacing.stackDense} text-center`}>
          <SimplePageBreadcrumbs
            className="justify-center"
            items={[
              { label: "Home", href: "/" },
              { label: "Ownership" },
            ]}
          />
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            You are now the verified owner of this product
          </h1>
          <p className="text-slate-600">
            Your ownership has been recorded. Warranty is active from today.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/ownership/history"
              className="inline-block rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              View my products
            </Link>
            <Link
              href="/"
              className="inline-block rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              Continue
            </Link>
          </div>
        </div>
      </NarrowContainer>
    </main>
  )
}
