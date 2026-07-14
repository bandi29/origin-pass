"use client"

import clsx from "clsx"
import { Copy, ExternalLink, Globe, Lock, RefreshCw, Shield } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { useInspector } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import { destinationCardBlockedMessage } from "@/components/dashboard/qr-identity/label-studio/label-studio-workflow-status"
import { DestinationTargetBlock } from "@/components/dashboard/qr-identity/DestinationTargetBlock"
import { QR_IDENTITY_PASSPORT_CREATE_PATH } from "@/lib/qr-identity-nav"

export function DestinationTab() {
  const { workflow, printPreviewScanUrl, primaryPassportProduct, copyScanLink, openScanPreview } =
    useInspector()
  const ready = workflow.destinationReady
  const blockedMessage = destinationCardBlockedMessage(workflow)

  return (
    <div>
      <div
        className={clsx(
          "rounded-2xl border p-4",
          ready
            ? "border-[#E7E2D7] bg-gradient-to-b from-white to-[#FCFBF8]"
            : "border-[#B9722B] bg-gradient-to-b from-white to-[#FBEEDD]",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              "grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] border bg-white",
              ready ? "border-[#356B4E] text-[#356B4E]" : "border-[#B9722B] text-[#B9722B]",
            )}
          >
            <Shield className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-[16.5px] font-semibold text-[#0E1B2A]">Digital Passport Destination</h3>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[#6B7079]">
              Customers scan this label to open the secure passport experience.
            </p>

            {ready ? (
              <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#356B4E] bg-[#E7F0EA] px-3 py-1.5 text-xs font-semibold text-[#27543D]">
                <span className="h-[7px] w-[7px] rounded-full bg-[#356B4E]" aria-hidden />
                {primaryPassportProduct?.passportId
                  ? `Passport · ${primaryPassportProduct.passportId.slice(0, 8)}…`
                  : "Secure link ready"}
              </span>
            ) : (
              <>
                <p className="mt-2.5 text-[12.5px] font-semibold leading-snug text-[#B9722B]" role="status">
                  {blockedMessage}
                </p>
                <span className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-[#B9722B] bg-[#FBEEDD] px-3 py-1.5 text-xs font-semibold text-[#B9722B]">
                  <span className="relative flex h-[7px] w-[7px]">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B9722B]/50 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-[#B9722B]" />
                  </span>
                  Awaiting passport
                </span>
              </>
            )}
          </div>
        </div>

        {ready ? (
          <>
            <div className="mt-3.5 flex items-center gap-2 rounded-[11px] border border-[#E7E2D7] bg-white px-3 py-2.5 font-mono text-[12.5px] text-[#15293E]">
              <Lock className="h-3.5 w-3.5 shrink-0 text-[#356B4E]" aria-hidden />
              <span className="truncate">{printPreviewScanUrl}</span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyScanLink()}
                className="inline-flex items-center justify-center gap-1.5 rounded-[9px] border border-[#E7E2D7] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#15293E] transition hover:border-[#15293E]"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy Link
              </button>
              <button
                type="button"
                onClick={openScanPreview}
                className="inline-flex items-center justify-center gap-1.5 rounded-[9px] border border-[#E7E2D7] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#15293E] transition hover:border-[#15293E]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Open Preview
              </button>
              <Link
                href={QR_IDENTITY_PASSPORT_CREATE_PATH}
                className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-[9px] border border-[#E7E2D7] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#15293E] transition hover:border-[#15293E]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Regenerate Secure URL
              </Link>
            </div>
          </>
        ) : null}
      </div>

      {ready ? (
        <div className="mt-4 flex items-start gap-3 rounded-[13px] border border-[#E7E2D7] bg-white p-3.5">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-[#E7F0EA] text-[#356B4E]">
            <Globe className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <DestinationTargetBlock previewUrl={printPreviewScanUrl} showCopy={false} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
