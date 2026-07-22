"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Download, ExternalLink, FileText, Loader2, RotateCcw, UploadCloud, X } from "lucide-react"
import { VerificationStatusPill } from "@/components/verification/VerificationStatusPill"
import { EvidenceScopeBadge } from "@/components/verification/EvidenceScopeBadge"
import type { EvidenceScope } from "@/lib/evidence-scope"
import {
  SUPPLIER_CERTIFICATE_ACCEPT,
  SUPPLIER_CERTIFICATE_ALLOWED_TYPES,
  SUPPLIER_CERTIFICATE_MAX_BYTES,
  SUPPLIER_CERTIFICATE_SIZE_ERROR,
  SUPPLIER_CERTIFICATE_TYPE_ERROR,
} from "@/lib/supplier-certificate-upload-policy"
import { openOutsideShopifyEmbed } from "@/lib/shopify-embedded-url"

type UploadPhase = "loading" | "idle" | "uploading" | "success" | "error"
type UploadErrorKind = "wrong_type" | "oversized" | "network" | "server" | null

type Certificate = {
  fileName: string
  status: string
  viewUrl: string | null
  scope: EvidenceScope
}

type PendingUpload = {
  file: File
  field: "location" | "care"
}

export type CertificateFieldHandle = {
  openFilePicker: () => void
}

const ERROR_COPY: Record<Exclude<UploadErrorKind, null>, string> = {
  wrong_type: SUPPLIER_CERTIFICATE_TYPE_ERROR,
  oversized: SUPPLIER_CERTIFICATE_SIZE_ERROR,
  network: "Upload interrupted — check your connection and try again.",
  server: "Upload failed. Please try again.",
}

async function sessionToken(): Promise<string | undefined> {
  if (typeof window === "undefined" || !window.shopify) return undefined
  try {
    return await window.shopify.idToken()
  } catch {
    return undefined
  }
}

function uploadCertificate(
  file: File,
  field: "location" | "care",
  shop: string,
  productId: string | undefined,
  onProgress: (percent: number) => void,
): Promise<{ ok: true; fileName: string; status: string; viewUrl: string | null; scope: EvidenceScope } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/shopify/certificates")
    xhr.responseType = "json"

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }

    xhr.onload = () => {
      const data = xhr.response as
        | {
            ok?: boolean
            fileName?: string
            status?: string
            publicUrl?: string | null
            signedUrl?: string | null
            scope?: EvidenceScope
            message?: string
          }
        | null
      if (xhr.status >= 200 && xhr.status < 300 && data?.ok && data.fileName) {
        resolve({
          ok: true,
          fileName: data.fileName,
          status: data.status ?? "self_attested",
          viewUrl: data.publicUrl ?? data.signedUrl ?? null,
          scope: data.scope ?? (productId ? "product" : "brand"),
        })
        return
      }
      resolve({ ok: false, message: data?.message ?? ERROR_COPY.server })
    }

    xhr.onerror = () => resolve({ ok: false, message: ERROR_COPY.network })
    xhr.onabort = () => resolve({ ok: false, message: ERROR_COPY.network })

    void (async () => {
      const body = new FormData()
      body.set("file", file)
      body.set("field", field)
      body.set("shop", shop)
      if (productId) body.set("productId", productId)
      const token = await sessionToken()
      if (token) {
        body.set("sessionToken", token)
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      }
      xhr.send(body)
    })()
  })
}

/**
 * Verification & Data Trust — attach supplier evidence at brand or product scope.
 */
export const CertificateField = forwardRef<
  CertificateFieldHandle,
  {
    shop: string
    field: "location" | "care"
    productId?: string
    dataProvenance?: "record" | "fallback"
    brandDefaultContext?: boolean
    inheritanceMode?: boolean
    /** Hide inline upload — parent renders conflict resolution panel. */
    conflictMode?: boolean
    onCertChange?: () => void
  }
>(function CertificateField(
  {
    shop,
    field,
    productId,
    dataProvenance = "fallback",
    brandDefaultContext = false,
    inheritanceMode = false,
    conflictMode = false,
    onCertChange,
  },
  ref,
) {
  const scopeMode: EvidenceScope = productId && !inheritanceMode ? "product" : "brand"
  const inputRef = useRef<HTMLInputElement>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [phase, setPhase] = useState<UploadPhase>("loading")
  const [uploadPercent, setUploadPercent] = useState(0)
  const [cert, setCert] = useState<Certificate | null>(null)
  const [errorKind, setErrorKind] = useState<UploadErrorKind>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [pendingRetry, setPendingRetry] = useState<PendingUpload | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  useImperativeHandle(ref, () => ({
    openFilePicker: () => inputRef.current?.click(),
  }))

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await sessionToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const loadCert = useCallback(async () => {
    try {
      const params = new URLSearchParams({ field, shop })
      if (productId && !inheritanceMode) params.set("productId", productId)
      const res = await fetch(`/api/shopify/certificates?${params}`, { headers: await authHeaders() })
      const data = (await res.json().catch(() => null)) as
        | {
            ok: boolean
            exists?: boolean
            fileName?: string
            status?: string
            publicUrl?: string | null
            signedUrl?: string | null
            scope?: EvidenceScope
          }
        | null
      if (data?.ok && data.exists && data.fileName) {
        setCert({
          fileName: data.fileName,
          status: data.status ?? "self_attested",
          viewUrl: data.publicUrl ?? data.signedUrl ?? null,
          scope: data.scope ?? scopeMode,
        })
      } else {
        setCert(null)
      }
      setPhase("idle")
    } catch {
      setCert(null)
      setPhase("idle")
    }
  }, [field, shop, productId, authHeaders, scopeMode, inheritanceMode])

  useEffect(() => {
    void loadCert()
  }, [loadCert])

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  async function runUpload(file: File) {
    setPhase("uploading")
    setUploadPercent(0)
    setErrorKind(null)
    setErrorMessage("")
    setPendingRetry(null)

    const result = await uploadCertificate(file, field, shop, productId, setUploadPercent)

    if (result.ok) {
      setCert({ fileName: result.fileName, status: result.status, viewUrl: result.viewUrl, scope: result.scope })
      setPhase("success")
      setUploadPercent(100)
      window.shopify?.toast.show("Evidence attached")
      successTimerRef.current = setTimeout(() => setPhase("idle"), 2500)
      onCertChange?.()
      return
    }

    setPhase("error")
    setErrorKind("server")
    setErrorMessage(result.message)
    setPendingRetry({ file, field })
    window.shopify?.toast.show(result.message, { isError: true })
  }

  async function handleFile(file: File | null) {
    if (!file || phase === "uploading") return

    if (!SUPPLIER_CERTIFICATE_ALLOWED_TYPES.includes(file.type)) {
      setPhase("error")
      setErrorKind("wrong_type")
      setErrorMessage(ERROR_COPY.wrong_type)
      setPendingRetry(null)
      window.shopify?.toast.show(ERROR_COPY.wrong_type, { isError: true })
      return
    }
    if (file.size > SUPPLIER_CERTIFICATE_MAX_BYTES) {
      setPhase("error")
      setErrorKind("oversized")
      setErrorMessage(ERROR_COPY.oversized)
      setPendingRetry(null)
      window.shopify?.toast.show(ERROR_COPY.oversized, { isError: true })
      return
    }

    await runUpload(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleRemove() {
    if (phase === "uploading") return
    const previous = cert
    setCert(null)
    setErrorKind(null)
    setErrorMessage("")
    setPendingRetry(null)
    try {
      const params = new URLSearchParams({ field, shop })
      if (productId) params.set("productId", productId)
      const res = await fetch(`/api/shopify/certificates?${params}`, { method: "DELETE", headers: await authHeaders() })
      if (!res.ok) throw new Error("delete_failed")
      setPhase("idle")
      window.shopify?.toast.show("Document removed")
      onCertChange?.()
    } catch {
      setCert(previous)
      setPhase("error")
      setErrorKind("server")
      setErrorMessage("Could not remove the document. Please try again.")
    }
  }

  /**
   * Prefer an in-app viewer — Shopify Admin's sandboxed iframe blocks most
   * `window.open` / `target=_blank` navigations (browser pop-up policy, not a
   * merchant settings misconfiguration). Fall back to a new tab only if the
   * viewer cannot mount.
   */
  function openCertificateDocument() {
    if (!cert?.viewUrl) {
      window.shopify?.toast.show("Document link is unavailable. Re-upload the certificate.", {
        isError: true,
        duration: 4000,
      })
      return
    }
    setViewerOpen(true)
  }

  if (phase === "loading") {
    return (
      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded-full bg-[#f1f2f3]" aria-hidden />
        <div className="h-9 animate-pulse rounded-lg bg-[#f1f2f3]" aria-hidden />
      </div>
    )
  }

  const hasDocument = Boolean(cert)
  const busy = phase === "uploading"
  const canRetry = phase === "error" && pendingRetry != null && errorKind !== "wrong_type" && errorKind !== "oversized"
  const activeScope = cert?.scope ?? (hasDocument ? scopeMode : "none")
  const scopeMismatch = dataProvenance === "record" && activeScope === "brand"
  const readOnlyInherited = inheritanceMode && hasDocument
  const showInlineUpload = !conflictMode || hasDocument

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {brandDefaultContext && !hasDocument ? (
          <span className="inline-flex items-center rounded-full border border-[#d9d9d9] bg-[#fafbfb] px-2.5 py-1 text-[11px] font-medium text-[#5c5f62]">
            No brand-level evidence yet — products inheriting this default will appear unverified on their passports.
          </span>
        ) : (
          <VerificationStatusPill
            variant="merchant"
            hasDocument={hasDocument}
            status={cert?.status}
            evidenceScope={activeScope}
            scopeMismatch={scopeMismatch}
          />
        )}
        {hasDocument ? (
          <EvidenceScopeBadge scope={activeScope} dataProvenance={dataProvenance} variant="merchant" />
        ) : null}
      </div>

      {phase === "success" ? (
        <p className="rounded-lg border border-[#b4fed2] bg-[#ecfdf3] px-3 py-2 text-xs font-medium text-[#0d542b]">
          Evidence attached successfully.
        </p>
      ) : null}

      {hasDocument && !busy && phase !== "success" ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-[#c9cccf] bg-[#fafbfb] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            {cert?.viewUrl ? (
              <button
                type="button"
                onClick={openCertificateDocument}
                className="block max-w-full truncate text-left text-sm font-medium text-[#202223] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1"
              >
                {cert.fileName}
              </button>
            ) : (
              <span className="block truncate text-sm font-medium text-[#202223]">{cert?.fileName}</span>
            )}
            <p className="mt-0.5 text-xs text-[#6d7175]">
              {readOnlyInherited
                ? "Inherited from brand default — verified at brand level"
                : activeScope === "product"
                  ? "Verified for this product"
                  : "Brand-level supporting document · applies to store-wide defaults"}
            </p>
          </div>
          {cert?.viewUrl ? (
            <button
              type="button"
              onClick={openCertificateDocument}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#c9cccf] bg-white px-2.5 py-1 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9cccf]"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              View Document
            </button>
          ) : null}
          {!readOnlyInherited ? (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="shrink-0 rounded-md border border-[#c9cccf] bg-white px-2 py-1 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => void handleRemove()}
                aria-label="Delete document"
                className="shrink-0 rounded-md p-1 text-[#5c5f62] transition hover:bg-[#f1f2f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      ) : showInlineUpload && (!hasDocument || busy) ? (
        inheritanceMode ? (
          <p className="rounded-lg border border-[#e3e3e3] bg-[#fafbfb] px-3 py-2 text-xs text-[#6d7175]">
            No brand-level evidence on file yet. Upload evidence on the Store configuration screen, or override this
            field to attach product-specific proof.
          </p>
        ) : (
          <DropButton busy={busy} uploadPercent={uploadPercent} onPick={() => inputRef.current?.click()} onFile={(f) => void handleFile(f)} />
        )
      ) : null}

      {busy ? (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e3e3e3]" aria-hidden>
            <div
              className="h-full rounded-full bg-[#303030] transition-[width] duration-150 ease-out"
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
          <p className="text-xs font-medium text-[#5c5f62]">Uploading… {uploadPercent}%</p>
        </div>
      ) : phase === "error" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-[#8e1b16]">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {errorMessage}
          </p>
          {canRetry ? (
            <button
              type="button"
              onClick={() => void runUpload(pendingRetry!.file)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#c9cccf] bg-white px-2.5 py-1.5 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Retry upload
            </button>
          ) : null}
        </div>
      ) : !hasDocument && phase === "idle" && !inheritanceMode && showInlineUpload ? (
        <p className="text-xs leading-relaxed text-[#6d7175]">
          🔒 Accepted formats: PDF, JPG, PNG up to 5MB. Attached supplier certificates are edge-cached to maintain
          near-instant consumer page rendering.
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={SUPPLIER_CERTIFICATE_ACCEPT}
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      {viewerOpen && cert?.viewUrl ? (
        <CertificateDocumentViewer
          fileName={cert.fileName}
          viewUrl={cert.viewUrl}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </div>
  )
})

function isLikelyPdf(fileName: string, viewUrl: string): boolean {
  const name = fileName.toLowerCase()
  const url = viewUrl.toLowerCase()
  return name.endsWith(".pdf") || url.includes(".pdf")
}

function isLikelyImage(fileName: string, viewUrl: string): boolean {
  const name = fileName.toLowerCase()
  const url = viewUrl.toLowerCase()
  return /\.(jpe?g|png|webp|gif)$/i.test(name) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)
}

/**
 * In-iframe document preview — avoids Shopify Admin pop-up blockers.
 * PDFs/images render inline; merchants can still download via a same-tab link.
 */
function CertificateDocumentViewer({
  fileName,
  viewUrl,
  onClose,
}: {
  fileName: string
  viewUrl: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const pdf = isLikelyPdf(fileName, viewUrl)
  const image = isLikelyImage(fileName, viewUrl)

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="certificate-viewer-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#e3e3e3] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#e3e3e3] px-4 py-3">
          <div className="min-w-0">
            <p id="certificate-viewer-title" className="truncate text-sm font-semibold text-[#202223]">
              {fileName}
            </p>
            <p className="text-xs text-[#6d7175]">Supplier certificate preview</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={viewUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                // Cross-origin download often becomes in-iframe navigation — escape Admin iframe.
                e.preventDefault()
                openOutsideShopifyEmbed(viewUrl, "blank")
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9cccf] bg-white px-2.5 py-1.5 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download
            </a>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                openOutsideShopifyEmbed(viewUrl, "blank")
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9cccf] bg-white px-2.5 py-1.5 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7]"
              title="Opens outside the Shopify admin iframe"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Open full page
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document viewer"
              className="rounded-md p-1.5 text-[#5c5f62] transition hover:bg-[#f1f2f3]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[#f6f6f7] p-3">
          {pdf ? (
            <iframe
              title={fileName}
              src={viewUrl}
              className="h-[min(70vh,720px)] w-full rounded-lg border border-[#e3e3e3] bg-white"
            />
          ) : image ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Supabase public URL
            <img
              src={viewUrl}
              alt={fileName}
              className="mx-auto max-h-[min(70vh,720px)] max-w-full rounded-lg border border-[#e3e3e3] bg-white object-contain"
            />
          ) : (
            <div className="flex h-[240px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#c9cccf] bg-white px-6 text-center">
              <FileText className="h-8 w-8 text-[#8c9196]" aria-hidden />
              <p className="text-sm text-[#6d7175]">
                Preview is not available for this file type. Use Download or Open full page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DropButton({
  busy,
  uploadPercent,
  onPick,
  onFile,
}: {
  busy: boolean
  uploadPercent: number
  onPick: () => void
  onFile: (file: File | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onFile(e.dataTransfer.files?.[0] ?? null)
      }}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1 disabled:cursor-not-allowed ${
        dragOver
          ? "border-[#303030] bg-[#f6f6f7] text-[#202223]"
          : "border-[#c9cccf] bg-white text-[#5c5f62] hover:border-[#9ca0a3] hover:bg-[#fafbfb]"
      }`}
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Uploading… {uploadPercent}%
        </>
      ) : (
        <>
          <UploadCloud className="h-4 w-4" aria-hidden />
          Attach verifying document
        </>
      )}
    </button>
  )
}
