"use client"

import { useRef, useState } from "react"
import { Download, FileDown } from "lucide-react"
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react"
import { ExportPdfModal } from "@/components/admin/ExportPdfModal"

type PassportQRTabProps = {
  passportId: string
  passportUid: string
  serialNumber: string
  verifyToken?: string
  baseUrl: string
}

/**
 * QR rendering moved off the `qrcode` Node library (~50 KB gzipped, full image
 * generation toolchain bundled into the client) and onto `qrcode.react`, which
 * is purpose-built for React and ~5 KB. Downloads are produced by serialising the
 * already-rendered DOM nodes, so no extra runtime dependency is required.
 */
export function PassportQRTab({
  passportId,
  passportUid,
  serialNumber,
  verifyToken,
  baseUrl,
}: PassportQRTabProps) {
  const token = verifyToken ?? passportUid
  const verifyUrl = `${baseUrl}/verify/${token}`
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  const svgContainerRef = useRef<HTMLDivElement | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const handleDownloadPng = () => {
    const canvas = canvasContainerRef.current?.querySelector("canvas")
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `passport-${serialNumber}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, "image/png")
  }

  const handleDownloadSvg = () => {
    const svg = svgContainerRef.current?.querySelector("svg")
    if (!svg) return
    const serializer = new XMLSerializer()
    const source = `<?xml version="1.0" standalone="no"?>\n${serializer.serializeToString(svg)}`
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `passport-${serialNumber}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white p-4">
          <div ref={canvasContainerRef}>
            <QRCodeCanvas value={verifyUrl} size={192} marginSize={2} level="M" />
          </div>
          {/* Off-screen SVG used solely for the SVG download. */}
          <div ref={svgContainerRef} className="hidden" aria-hidden="true">
            <QRCodeSVG value={verifyUrl} size={192} marginSize={2} level="M" />
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Verification URL</p>
            <code className="mt-1 block break-all rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {verifyUrl}
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download SVG
            </button>
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <FileDown className="h-4 w-4" />
              Export Print PDF
            </button>
          </div>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">Embed code</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
          {`<img src="${verifyUrl}" alt="Verify product authenticity" width="120" height="120" />`}
        </pre>
      </div>

      <ExportPdfModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        passportId={passportId}
        serialNumber={serialNumber}
      />
    </div>
  )
}
