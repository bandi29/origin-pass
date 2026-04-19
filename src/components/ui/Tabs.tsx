"use client"

import { useState, type ReactNode } from "react"
import clsx from "clsx"

export type TabItem = {
  id: string
  label: string
  content: ReactNode
}

type TabsProps = {
  tabs: TabItem[]
  defaultTab?: string
  className?: string
  value?: string
  onValueChange?: (id: string) => void
}

export function Tabs({
  tabs,
  defaultTab,
  className,
  value,
  onValueChange,
}: TabsProps) {
  const initial = defaultTab ?? tabs[0]?.id ?? ""
  const [internal, setInternal] = useState(initial)
  const active = value ?? internal
  const setTab = (id: string) => {
    if (onValueChange) onValueChange(id)
    else setInternal(id)
  }

  const panel = tabs.find((t) => t.id === active)

  return (
    <div className={clsx("space-y-8", className)}>
      <div
        role="tablist"
        aria-label="Sections"
        className="flex flex-wrap gap-x-8 gap-y-2 border-b border-gray-200 pb-1 transition-all duration-200 md:gap-x-10"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`tab-${tab.id}`}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setTab(tab.id)}
              className={clsx(
                "-mb-px pb-2 text-sm font-medium transition-all duration-200",
                selected
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={panel ? `panel-${panel.id}` : undefined}
        aria-labelledby={panel ? `tab-${panel.id}` : undefined}
        className="min-h-[120px]"
      >
        {panel?.content}
      </div>
    </div>
  )
}
