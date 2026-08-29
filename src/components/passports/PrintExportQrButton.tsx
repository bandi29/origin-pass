"use client"

import { useState } from "react"
import { Printer } from "lucide-react"
import { ExportPdfModal } from "@/components/admin/ExportPdfModal"

type Props = {
  passportId: string
  serialNumber: string
  className?: string
  label?: string
}

/** Compact list-row trigger for Print & Export QR modal. */
export function PrintExportQrButton({
  passportId,
  serialNumber,
  className,
  label = "Print",
}: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        }
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>
      <ExportPdfModal
        open={open}
        onClose={() => setOpen(false)}
        passportId={passportId}
        serialNumber={serialNumber}
      />
    </>
  )
}
