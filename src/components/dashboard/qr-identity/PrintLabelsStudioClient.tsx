"use client"

import { LabelStudioScaffold } from "@/components/dashboard/qr-identity/label-studio/LabelStudioScaffold"
import type { LabelPrintStudioPayload } from "@/lib/label-print-studio-server-data"

/** Label Studio — viewport-bounded workspace (scroll regions are internal). */
export function PrintLabelsStudioClient({ payload }: { payload: LabelPrintStudioPayload }) {
  return (
    // Escape the standard dashboard page chrome (DashboardPageLayout wraps every
    // page in pt-6 / pb-10 md:pb-12 + a space-y gap). Cancelling the bottom
    // padding removes the empty band under the action bar; cancelling the top gap
    // pulls the studio flush under the breadcrumbs so it can fill the viewport.
    <div className="label-studio-page-host -mb-10 -mt-3 min-h-0 min-w-0 md:-mb-12 md:-mt-4">
      <LabelStudioScaffold payload={payload} />
    </div>
  )
}
