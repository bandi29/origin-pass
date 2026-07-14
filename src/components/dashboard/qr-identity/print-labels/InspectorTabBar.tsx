"use client"

import { useRef, type ComponentType } from "react"
import clsx from "clsx"
import type { InspectorTabStatus } from "@/components/dashboard/qr-identity/print-labels/inspector-context"

export type InspectorTabId = "layout" | "branding" | "destination" | "output"

export type InspectorTabDef = {
  id: InspectorTabId
  label: string
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  status: InspectorTabStatus
  /** Optional short text describing the status, surfaced to assistive tech. */
  statusLabel?: string
}

const STATUS_TEXT: Record<InspectorTabStatus, string> = {
  valid: "configured",
  attention: "needs attention",
  info: "",
}

function StatusDot({ status, statusLabel }: { status: InspectorTabStatus; statusLabel?: string }) {
  if (status === "info") return null
  const text = statusLabel ?? STATUS_TEXT[status]
  return (
    <span className="absolute right-[calc(50%-1.25rem)] top-2 inline-flex h-[7px] w-[7px]">
      {status === "attention" ? (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B9722B]/60 motion-reduce:animate-none" />
      ) : null}
      <span
        className={clsx(
          "relative inline-flex h-[7px] w-[7px] rounded-full",
          status === "valid" ? "bg-[#356B4E]" : "bg-[#B9722B]",
        )}
      />
      {text ? <span className="sr-only"> — {text}</span> : null}
    </span>
  )
}

export function InspectorTabBar({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: InspectorTabDef[]
  activeId: InspectorTabId
  onSelect: (id: InspectorTabId) => void
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const focusTab = (id: InspectorTabId) => {
    onSelect(id)
    // Defer focus to after the click handler so the newly-selected tab receives it.
    requestAnimationFrame(() => tabRefs.current[id]?.focus())
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    let next = index
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = tabs.length - 1
    focusTab(tabs[next].id)
  }

  return (
    <div
      role="tablist"
      aria-label="Inspector sections"
      aria-orientation="horizontal"
      className="flex gap-1 border-b border-[#E7E2D7]"
    >
      {tabs.map((tab, i) => {
        const active = tab.id === activeId
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el
            }}
            role="tab"
            id={`inspector-tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`inspector-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={clsx(
              "relative flex flex-1 flex-col items-center gap-1.5 rounded-t-xl px-1 pb-3 pt-2.5 transition-colors duration-150",
              active
                ? "bg-white text-[#0E1B2A] shadow-[inset_0_-2px_0_#356B4E]"
                : "text-[#6B7079] hover:text-[#15293E]",
            )}
          >
            <StatusDot status={tab.status} statusLabel={tab.statusLabel} />
            <Icon className="h-5 w-5" aria-hidden />
            <span className="text-[11.5px] font-semibold tracking-[0.01em]">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
