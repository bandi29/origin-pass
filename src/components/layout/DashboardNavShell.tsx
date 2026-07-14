"use client"

import { Suspense } from "react"
import DashboardSidebar from "@/components/dashboard/DashboardSidebar"
import { NavigationProgressProvider } from "@/components/layout/NavigationProgressProvider"

export function DashboardNavShell({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProgressProvider>
      <div className="flex gap-8">
        <Suspense fallback={<div className="w-64 shrink-0" aria-hidden />}>
          <DashboardSidebar />
        </Suspense>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </NavigationProgressProvider>
  )
}
