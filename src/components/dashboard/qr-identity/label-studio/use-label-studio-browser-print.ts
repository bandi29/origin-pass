"use client"

import { type RefObject } from "react"
import { useReactToPrint } from "react-to-print"

const PRINT_PAGE_STYLE = `
  @page {
    size: auto;
    margin: 12mm;
  }
  @media print {
    html, body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-studio-print-root {
      position: static !important;
      display: block !important;
      width: auto !important;
      height: auto !important;
      max-width: none !important;
      max-height: none !important;
      overflow: visible !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .label-preview-zoom-layer {
      transform: none !important;
    }
  }
`

/** Opens the system print dialog for the on-canvas label preview. */
export function useLabelStudioBrowserPrint(printContentRef: RefObject<HTMLDivElement | null>) {
  return useReactToPrint({
    contentRef: printContentRef,
    documentTitle: "OriginPass Labels",
    pageStyle: PRINT_PAGE_STYLE,
    onPrintError: (_location, error) => {
      console.error("[Label Studio] Print failed:", error)
    },
  })
}
