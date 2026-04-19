"use client"

import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { Printer } from "lucide-react"
import { PrintLabels } from "./PrintLabels"

interface BatchPrintSheetProps {
    codes: { serialId: string }[]
    baseUrl: string
    buttonLabel?: string
    buttonClassName?: string
}

export default function BatchPrintSheet({
    codes,
    baseUrl,
    buttonLabel = "Print Sheet",
    buttonClassName = "inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition gap-2 shadow-sm",
}: BatchPrintSheetProps) {
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef: printRef,
    })

    return (
        <>
            <button
                type="button"
                onClick={() => handlePrint()}
                className={buttonClassName}
            >
                <Printer className="w-4 h-4" />
                {buttonLabel}
            </button>
            <div className="hidden">
                <PrintLabels
                    ref={printRef}
                    codes={codes}
                    baseUrl={baseUrl}
                />
            </div>
        </>
    )
}
