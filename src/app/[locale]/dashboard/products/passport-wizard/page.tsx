import { Suspense } from "react"
import { PassportCreationWizard } from "@/components/dashboard/PassportCreationWizard"

export default function PassportWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">
          Loading wizard…
        </div>
      }
    >
      <PassportCreationWizard />
    </Suspense>
  )
}
