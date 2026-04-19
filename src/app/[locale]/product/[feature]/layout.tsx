import type { ReactNode } from "react"

/**
 * Layout for product module pages (/product/passports, /product/authenticity, etc.)
 * and their nested routes (e.g. /product/passports/overview).
 * Add sub-navigation or sidebar here when deeper functionality is added.
 */
export default function ProductFeatureLayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}
