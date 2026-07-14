"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Bell, CircleHelp, Search } from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import clsx from "clsx"
import {
  certificationWizardHref,
  certificationWizardHrefFromHints,
  PRINT_LABELS_STUDIO_PATH,
  PRODUCTS_HUB_PATH,
  resolveCertificationProductIdFromHints,
  resolveExportReadyStudioHref,
} from "@/lib/dashboard-notification-routing"
import {
  mergeNotificationReadFlags,
  readStoredNotificationIds,
  storeNotificationReadIds,
} from "@/lib/dashboard-notifications-read"
import {
  VERIFICATION_NAV_FALLBACK_HREF,
  VERIFICATION_ROUTES,
  VERIFICATION_SUITE_NAV_VISIBLE,
} from "@/lib/verification-nav"

export type NotificationKind = "certification_required" | "export_ready" | "regulatory_update"

export type NotificationItem = {
  id: string
  title: string
  description: string
  time: string
  isRead: boolean
  kind: NotificationKind
  /** IDs for contextual deep links (from alerts / jobs). */
  metadata?: {
    productId?: string
    /** When `productId` is absent, resolved via `/api/products/resolve?sku=` (exact, case-insensitive). */
    productSku?: string
    /** Second resolver: case-insensitive name / contains match (demo-friendly when SKU is unset in DB). */
    productName?: string
    batchId?: string
    /** Prefills Label Studio product search when ids are missing (real jobs should send batchId or productId). */
    printSearch?: string
  }
  variant: "warning" | "success" | "info"
}

/** Demo metadata — replace with API-driven notifications; omit IDs to fall back to module hubs. */
const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    title: "Certification required",
    description:
      "Material authenticity certification is missing on Leather Tote Bag (SKU-302). Open the product to complete DPP fields.",
    time: "2m ago",
    isRead: false,
    kind: "certification_required",
    metadata: {
      productSku: "SKU-302",
      productName: "Leather Tote Bag",
    },
    variant: "warning",
  },
  {
    id: "n2",
    title: "Export ready",
    description: "PDF export for Linen Shirt Label Batch is ready. Open Print Labels to download or print.",
    time: "1h ago",
    isRead: false,
    kind: "export_ready",
    metadata: { printSearch: "Linen Shirt" },
    variant: "success",
  },
  {
    id: "n3",
    title: "Regulatory update",
    description: "EU textile regulations: 2028 guidance draft is available in documentation.",
    time: "Yesterday",
    isRead: false,
    kind: "regulatory_update",
    variant: "info",
  },
]

function seedNotificationsWithDemoProductId(items: NotificationItem[]): NotificationItem[] {
  const demoCertId =
    typeof process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRODUCT_ID === "string"
      ? process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRODUCT_ID.trim()
      : ""
  const demoPrintId =
    typeof process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRINT_PRODUCT_ID === "string"
      ? process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRINT_PRODUCT_ID.trim()
      : ""

  if (!demoCertId && !demoPrintId) return items

  return items.map((n) => {
    if (n.id === "n1" && n.kind === "certification_required" && demoCertId) {
      return {
        ...n,
        metadata: {
          ...n.metadata,
          productId: n.metadata?.productId?.trim() || demoCertId,
        },
      }
    }
    if (n.id === "n2" && n.kind === "export_ready") {
      const pid = n.metadata?.productId?.trim() || demoPrintId || demoCertId
      if (!pid) return n
      return {
        ...n,
        metadata: {
          ...n.metadata,
          productId: pid,
        },
      }
    }
    return n
  })
}

async function resolveCertificationNotificationUrl(metadata?: NotificationItem["metadata"]): Promise<string> {
  const envDemoId =
    typeof process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRODUCT_ID === "string"
      ? process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRODUCT_ID.trim()
      : ""

  const id = metadata?.productId?.trim()
  if (id) return certificationWizardHref(id)

  const sku = metadata?.productSku?.trim()
  const productName = metadata?.productName?.trim()
  if (!sku && !productName) return PRODUCTS_HUB_PATH

  const resolved = await resolveCertificationProductIdFromHints({ sku, productName })
  if (resolved) return certificationWizardHref(resolved)

  if (envDemoId) return certificationWizardHref(envDemoId)
  /** Stay in the wizard with hints so the page can retry resolve (e.g. session ready) instead of dumping users on Products. */
  return certificationWizardHrefFromHints({ certSku: sku, certName: productName })
}

function resolveExportReadyNotificationUrl(metadata?: NotificationItem["metadata"]): string {
  const fallbackPrint =
    typeof process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRINT_PRODUCT_ID === "string"
      ? process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRINT_PRODUCT_ID.trim()
      : typeof process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRODUCT_ID === "string"
        ? process.env.NEXT_PUBLIC_NOTIFICATION_DEMO_PRODUCT_ID.trim()
        : ""
  return resolveExportReadyStudioHref(metadata, { fallbackProductId: fallbackPrint || undefined })
}

function resolveNotificationPath(n: NotificationItem): string {
  switch (n.kind) {
    case "certification_required":
      return PRODUCTS_HUB_PATH
    case "export_ready":
      return PRINT_LABELS_STUDIO_PATH
    case "regulatory_update":
      return "/dashboard/system/documentation"
    default:
      return "/dashboard"
  }
}

const HELP_TOPICS = [
  {
    id: "textile-leather",
    title: "Textile & Leather Rules",
    body: "Quick guide on EU ESPR requirements for physical fabrics.",
  },
  {
    id: "label-studio",
    title: "Label Studio Setup",
    body: "How to align margins and print at 100% scale.",
  },
  {
    id: "qr-security",
    title: "QR Security",
    body: "What to do if a QR passport is flagged as compromised.",
  },
] as const

function notificationAccent(v: NotificationItem["variant"]) {
  if (v === "warning") return "border-l-amber-400 bg-amber-50/40"
  if (v === "success") return "border-l-emerald-500 bg-emerald-50/35"
  return "border-l-blue-500 bg-blue-50/35"
}

export function DashboardSearchChrome() {
  const router = useRouter()
  const [notifications, setNotifications] = useState(() =>
    seedNotificationsWithDemoProductId(INITIAL_NOTIFICATIONS),
  )
  const [notifOpen, setNotifOpen] = useState(false)
  const [helpQuery, setHelpQuery] = useState("")

  useEffect(() => {
    const read = readStoredNotificationIds()
    if (read.size === 0) return
    setNotifications((prev) => mergeNotificationReadFlags(prev, read))
  }, [])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications])

  const filteredHelp = useMemo(() => {
    const q = helpQuery.trim().toLowerCase()
    if (!q) return HELP_TOPICS
    return HELP_TOPICS.filter(
      (t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q),
    )
  }, [helpQuery])

  function markAllRead() {
    setNotifications((prev) => {
      storeNotificationReadIds(prev.map((n) => n.id))
      return prev.map((n) => ({ ...n, isRead: true }))
    })
  }

  function markOneRead(id: string) {
    storeNotificationReadIds([id])
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }

  async function openNotificationTarget(n: NotificationItem) {
    markOneRead(n.id)
    setNotifOpen(false)

    let path: string
    if (n.kind === "certification_required") {
      path = await resolveCertificationNotificationUrl(n.metadata)
    } else if (n.kind === "export_ready") {
      path = resolveExportReadyNotificationUrl(n.metadata)
    } else {
      path = resolveNotificationPath(n)
    }

    if (path.startsWith("http://") || path.startsWith("https://")) {
      window.open(path, "_blank", "noopener,noreferrer")
      return
    }
    router.push(path.startsWith("/") ? path : `/${path}`)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          type="search"
          name="dashboard-search"
          placeholder="Search passports, scans, products..."
          className="border-border bg-slate-50 pl-9 focus:bg-white"
        />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-border px-3 py-2 text-muted transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
              aria-haspopup="dialog"
            >
              <span className="relative inline-flex shrink-0">
                <Bell className="h-4 w-4" aria-hidden />
                {unreadCount > 0 ? (
                  <span
                    className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className="hidden sm:inline">Notifications</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="border-0 bg-transparent p-0 shadow-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  className="cursor-pointer text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Mark all as read
                </button>
              </div>
              <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotificationTarget(n)}
                      className={clsx(
                        "flex w-full gap-3 border-l-4 px-4 py-3 text-left transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:ring-offset-2",
                        notificationAccent(n.variant),
                      )}
                    >
                      <div className="flex w-2 shrink-0 justify-center pt-1.5" aria-hidden>
                        {!n.isRead ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={clsx(
                              "text-sm leading-snug text-slate-900",
                              !n.isRead && "font-semibold",
                            )}
                          >
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{n.time}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.description}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-4 py-2.5">
                <Link
                  href={
                    VERIFICATION_SUITE_NAV_VISIBLE
                      ? VERIFICATION_ROUTES.alerts
                      : VERIFICATION_NAV_FALLBACK_HREF
                  }
                  onClick={() => setNotifOpen(false)}
                  className="block cursor-pointer text-center text-xs font-medium text-slate-600 underline-offset-2 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  View all notifications
                </Link>
              </div>
            </motion.div>
          </PopoverContent>
        </Popover>

        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-border px-3 py-2 text-muted transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900"
              aria-label="Help and documentation"
            >
              <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Help</span>
            </button>
          </SheetTrigger>
          <SheetContent className="w-full max-w-[400px] p-0 sm:max-w-[540px]">
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col p-6 pr-14 pt-6">
                <SheetTitle className="text-xl font-semibold tracking-tight text-slate-900">
                  Help &amp; Compliance Support
                </SheetTitle>
                <SheetDescription className="mt-2 text-sm leading-relaxed text-slate-600">
                  Find quick answers on EU compliance, labels, and QR security. We&apos;re here when you need a human.
                </SheetDescription>
                <label className="mt-5 block">
                  <span className="sr-only">Search guides and regulations</span>
                  <Input
                    type="search"
                    value={helpQuery}
                    onChange={(e) => setHelpQuery(e.target.value)}
                    placeholder="Search guides & regulations..."
                    className="border-slate-200 bg-slate-50 text-sm focus:bg-white"
                  />
                </label>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                  {filteredHelp.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">No guides match your search.</p>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {filteredHelp.map((topic) => (
                        <AccordionItem key={topic.id} value={topic.id}>
                          <AccordionTrigger className="text-[15px]">{topic.title}</AccordionTrigger>
                          <AccordionContent>{topic.body}</AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Direct support</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" size="sm" className="w-full sm:flex-1" href="/support">
                      Email Support
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:flex-1"
                      href="mailto:support@originpass.com?subject=Compliance%20expert%20request"
                      external
                    >
                      Chat with a Compliance Expert
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
