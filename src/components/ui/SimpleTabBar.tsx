"use client"

import clsx from "clsx"

type Props = {
  tabs: string[]
  active: string
  onChange: (tab: string) => void
  className?: string
}

/** Controlled tab labels only — pair with your own panel content */
export function SimpleTabBar({ tabs, active, onChange, className }: Props) {
  return (
    <div
      role="tablist"
      className={clsx("flex flex-wrap gap-6 border-b border-gray-200", className)}
    >
      {tabs.map((tab) => {
        const selected = active === tab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab)}
            className={clsx(
              "-mb-px pb-2 text-sm transition-all duration-200",
              selected
                ? "border-b-2 border-slate-900 font-medium text-slate-900"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {tab}
          </button>
        )
      })}
    </div>
  )
}
