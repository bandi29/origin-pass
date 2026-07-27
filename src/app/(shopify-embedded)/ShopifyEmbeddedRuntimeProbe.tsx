"use client"

import { useEffect, useState, type ReactNode } from "react"

const CHUNK_RELOAD_KEY = "originpass:chunk-reload-once"

const TRANSIENT_LOAD_RE =
  /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i

/**
 * Surfaces uncaught client errors in the iframe instead of a silent white screen.
 * Render errors are handled by error.tsx; this catches script/runtime failures.
 *
 * First load through a fresh Cloudflare tunnel often throws a one-shot chunk
 * load error that a refresh fixes -- auto-reload once for those, then show UI.
 */
export function ShopifyEmbeddedRuntimeProbe({ children }: { children: ReactNode }) {
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  useEffect(() => {
    const handle = (message: string) => {
      if (TRANSIENT_LOAD_RE.test(message) && typeof window !== "undefined") {
        try {
          if (!window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
            window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1")
            window.location.reload()
            return
          }
        } catch {
          // sessionStorage blocked -- fall through to banner
        }
      }
      setRuntimeError(message || "Unknown script error")
    }

    const onError = (event: ErrorEvent) => {
      handle(event.message || "Unknown script error")
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message =
        reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unhandled error"
      handle(message)
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  // After a stable load, allow a future one-shot auto-reload in this tab.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
      } catch {
        // ignore
      }
    }, 5000)
    return () => window.clearTimeout(t)
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
