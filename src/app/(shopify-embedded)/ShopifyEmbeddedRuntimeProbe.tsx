"use client"

import { useEffect, useState, type ReactNode } from "react"

/**
 * Surfaces uncaught client errors in the iframe instead of a silent white screen.
 * Render errors are handled by error.tsx; this catches script/runtime failures.
 */
export function ShopifyEmbeddedRuntimeProbe({ children }: { children: ReactNode }) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      setRuntimeError(event.message || "Unknown script error")
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message =
        reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unhandled error"
      setRuntimeError(message)
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return (
    <>
      {runtimeError ? (
        <div
          className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          role="alert"
        >
          <strong className="font-semibold">OriginPass failed to load.</strong>{" "}
          <span className="text-red-900">{runtimeError}</span>{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-1 font-medium underline hover:no-underline"
          >
            Reload
          </button>
        </div>
      ) : null}
      {children}
    </>
  )
}
