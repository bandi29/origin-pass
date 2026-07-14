"use client"

import clsx from "clsx"
import { InspectorPanel } from "@/components/dashboard/qr-identity/print-labels/InspectorPanel"
import type { InspectorContextValue } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import type { InspectorTabId } from "@/components/dashboard/qr-identity/print-labels/InspectorTabBar"
import type { LabelStudioInspectorTab } from "@/components/dashboard/qr-identity/label-studio/types"

function toInspectorTabId(tab: LabelStudioInspectorTab): InspectorTabId {
  return tab
}

function fromInspectorTabId(tab: InspectorTabId): LabelStudioInspectorTab {
  return tab
}

export function LabelStudioInspectorColumn({
  value,
  embedded = false,
  activeTab,
  onTabChange,
}: {
  value: InspectorContextValue
  embedded?: boolean
  activeTab?: LabelStudioInspectorTab
  onTabChange?: (tab: LabelStudioInspectorTab) => void
}) {
  const panel = (
    <InspectorPanel
      value={value}
      variant={embedded ? "embedded" : "column"}
      activeTab={activeTab ? toInspectorTabId(activeTab) : undefined}
      onTabChange={onTabChange ? (id) => onTabChange(fromInspectorTabId(id)) : undefined}
    />
  )

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden" aria-label="Inspector">
        {panel}
      </div>
    )
  }

  return (
    <aside
      className={clsx(
        "flex h-full min-h-0 w-[clamp(340px,30%,400px)] shrink-0 flex-col overflow-hidden border-l border-[#E7E2D7] bg-gradient-to-b from-[#FCFBF8] to-[#F7F4EE]",
        "max-[859px]:hidden",
      )}
      aria-label="Inspector"
    >
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{panel}</div>
    </aside>
  )
}
