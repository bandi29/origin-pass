"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import QRCode from "qrcode"

type PassportQRTabProps = {
  passportUid: string
  serialNumber: string
  verifyToken?: string
  baseUrl: string
}

export function PassportQRTab({
  passportUid,
  serialNumber,
  verifyToken,
  baseUrl,
}: PassportQRTabProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const token = verifyToken ?? passportUid
  const verifyUrl = `${baseUrl}/verify/${token}`

  useEffect(() => {
    QRCode.toDataURL(verifyUrl, { width: 256, margin: 2 }).then(setQrDataUrl)
  }, [verifyUrl])

  const handleDownload = async (format: "png" | "svg") => {
    if (format === "png" && qrDataUrl) {
      const a = document.createElement("a")
      a.href = qrDataUrl
      a.download = `passport-${serialNumber}.png`
      a.click()
      return
    }
    if (format === "svg") {
      const svg = await QRCode.toString(verifyUrl, { type: "svg", margin: 2 })
      const blob = new Blob([svg], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `passport-${serialNumber}.svg`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white p-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for passport ${serialNumber}`}
              className="h-48 w-48"
            />
          ) : (
            <div className="h-48 w-48 animate-pulse rounded bg-slate-100" />
          )}
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
              onClick={() => handleDownload("png")}
              disabled={!qrDataUrl}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <button
              type="button"
              onClick={() => handleDownload("svg")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download SVG
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
    </div>
  )
}
