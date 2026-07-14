"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { Globe, LayoutGrid, Palette, Printer, Sparkles } from "lucide-react"
import {
  InspectorProvider,
  type InspectorContextValue,
} from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import { InspectorPreviewDock } from "@/components/dashboard/qr-identity/print-labels/InspectorPreviewDock"
import {
  InspectorTabBar,
  type InspectorTabDef,
  type InspectorTabId,
} from "@/components/dashboard/qr-identity/print-labels/InspectorTabBar"
import { LayoutTab } from "@/components/dashboard/qr-identity/print-labels/inspector-tabs/LayoutTab"
import { BrandingTab } from "@/components/dashboard/qr-identity/print-labels/inspector-tabs/BrandingTab"
import { DestinationTab } from "@/components/dashboard/qr-identity/print-labels/inspector-tabs/DestinationTab"
import { OutputTab } from "@/components/dashboard/qr-identity/print-labels/inspector-tabs/OutputTab"
import { INSPECTOR_TAB_PANEL_CLASS } from "@/components/dashboard/qr-identity/label-studio/constants"

function InspectorTabPanel({
  activeTab,
  scrollRef,
  className,
}: {
  activeTab: InspectorTabId
  scrollRef: RefObject<HTMLDivElement | null>
  className: string
}) {
  return (
    <div ref={scrollRef} className={className}>
      <div
        key={activeTab}
        role="tabpanel"
        id={`inspector-panel-${activeTab}`}
        aria-labelledby={`inspector-tab-${activeTab}`}
        className={INSPECTOR_TAB_PANEL_CLASS}
      >
        {activeTab === "layout" ? <LayoutTab /> : null}
        {activeTab === "branding" ? <BrandingTab /> : null}
        {activeTab === "destination" ? <DestinationTab /> : null}
        {activeTab === "output" ? <OutputTab /> : null}
      </div>
    </div>
  )
}

export function InspectorPanel({
  value,
  variant = "card",
  activeTab: controlledTab,
  onTabChange,
}: {
  value: InspectorContextValue
  /** `column` = Label Studio right rail; `embedded` = mobile sheet. */
  variant?: "card" | "column" | "embedded"
  activeTab?: InspectorTabId
  onTabChange?: (id: InspectorTabId) => void
}) {
  const [internalTab, setInternalTab] = useState<InspectorTabId>("layout")
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onTabChange ?? setInternalTab
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [activeTab])

  const { workflow } = value

  const tabs: InspectorTabDef[] = [
    { id: "layout", label: "Layout", icon: LayoutGrid, status: "valid", statusLabel: "configured" },
    { id: "branding", label: "Branding", icon: Palette, status: "valid", statusLabel: "configured" },
    {
      id: "destination",
      label: "Destination",
      icon: Globe,
      status: workflow.destinationInspectorTabStatus,
      statusLabel: workflow.destinationInspectorTabLabel,
    },
    { id: "output", label: "Output", icon: Printer, status: "info" },
  ]

  const isColumn = variant === "column" || variant === "embedded"
  const panelScrollClass = isColumn
    ? "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-b-2xl border border-[#E7E2D7] bg-white p-4 [&_details]:overflow-visible"
    : "-mt-4 max-h-[460px] min-h-0 overflow-y-auto overscroll-contain rounded-b-2xl border border-t-0 border-[#E7E2D7] bg-white p-5 [&_details]:overflow-visible"

  return (
    <InspectorProvider value={value}>
      {isColumn ? (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-hidden px-3 pb-3 pt-2">
          <div className="flex shrink-0 flex-col gap-1.5 min-w-0">
            <InspectorPreviewDock compact />
            <div className="shrink-0 min-w-0">
              <InspectorTabBar tabs={tabs} activeId={activeTab} onSelect={setActiveTab} />
            </div>
          </div>

          <InspectorTabPanel
            activeTab={activeTab}
            scrollRef={scrollRef}
            className={`mt-1.5 ${panelScrollClass}`}
          />
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#E7F0EA] text-[#356B4E]">
              <Sparkles className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-serif text-[21px] font-semibold leading-none tracking-tight text-[#0E1B2A]">
                Inspector
              </h3>
              <p className="mt-1 text-[12.5px] text-[#6B7079]">Everything for this label, grouped.</p>
            </div>
          </div>

          <InspectorPreviewDock />
          <div className="shrink-0 min-w-0">
            <InspectorTabBar tabs={tabs} activeId={activeTab} onSelect={setActiveTab} />
          </div>

          <InspectorTabPanel activeTab={activeTab} scrollRef={scrollRef} className={panelScrollClass} />
        </div>
      )}
    </InspectorProvider>
  )
}
