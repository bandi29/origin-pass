"use client"

import { useParams } from "next/navigation"
import { useEffect } from "react"

/**
 * Dashboard entry for regulatory deep links; forwards to public documentation anchor.
 */
export default function DashboardSystemDocumentationPage() {
  const { locale } = useParams() as { locale: string }

  useEffect(() => {
    window.location.replace(`/${locale}/documentation#textile-2028`)
  }, [locale])

  return (
    <div className="p-8 text-center text-sm text-slate-600">Opening documentation…</div>
  )
}
