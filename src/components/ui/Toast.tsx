"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import clsx from "clsx"

type ToastType = "success" | "error" | "info"

type ToastItem = { id: string; type: ToastType; message: string }

type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((type: ToastType, message: string) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now())
    setToasts((t) => [...t, { id, type, message }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  }

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const portal =
    mounted && typeof document !== "undefined" ? (
      createPortal(
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-full max-w-sm flex-col gap-2 p-4 sm:p-0"
          role="region"
          aria-label="Notifications"
        >
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto"
                role="status"
              >
                <div
                  className={clsx(
                    "flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm",
                    t.type === "success" &&
                      "border-emerald-200 bg-white/95 text-emerald-900",
                    t.type === "error" &&
                      "border-rose-200 bg-white/95 text-rose-900",
                    t.type === "info" &&
                      "border-slate-200 bg-white/95 text-slate-900"
                  )}
                >
                  {t.type === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : t.type === "error" ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                  ) : (
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-ds-secondary" />
                  )}
                  <p className="text-sm font-medium leading-snug">{t.message}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )
    ) : null

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portal}
    </ToastContext.Provider>
  )
}
