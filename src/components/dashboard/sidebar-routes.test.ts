import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"

const ROOT =
  "/Volumes/Vijay/Projects - Web/Artisian Tracebility - OriginPass/OriginPass/src/app/[locale]"

function pageForRoute(route: string): string {
  return join(ROOT, route.replace(/^\//, ""), "page.tsx")
}

function isRouteResolvable(route: string): boolean {
  const normalized = route.replace(/^\//, "")
  const segments = normalized.split("/").filter(Boolean)
  const exact = join(ROOT, normalized, "page.tsx")
  if (existsSync(exact)) return true

  // Resolve catch-all folders such as /dashboard/scans/[...section]/page.tsx
  for (let i = segments.length - 1; i >= 1; i -= 1) {
    const prefix = segments.slice(0, i).join("/")
    const catchAll = join(ROOT, prefix, "[...section]", "page.tsx")
    if (existsSync(catchAll)) return true
  }
  return false
}

describe("dashboard and nav routes resolve", () => {
  it("resolves all dashboard sidebar routes", () => {
    const routes = [
      "/dashboard",
      "/dashboard/products",
      "/dashboard/product-passports",
      "/dashboard/product-passports/create",
      "/dashboard/verification",
      "/dashboard/verification/rules",
      "/dashboard/verification/alerts",
      "/dashboard/verification/analytics",
      "/dashboard/verification/map",
      "/dashboard/verification/audit",
      "/dashboard/product-identity/verification/audit-logs",
      "/dashboard/operations/security-logs",
      "/dashboard/operations/audit-logs",
      "/dashboard/authenticity",
      "/dashboard/authenticity/rules",
      "/dashboard/authenticity/alerts",
      "/dashboard/qr-identity",
      "/dashboard/qr-identity/all",
      "/dashboard/qr-identity/batch",
      "/dashboard/qr-identity/print",
      "/dashboard/qr-identity/verification",
      "/dashboard/ownership",
      "/dashboard/ownership/records",
      "/dashboard/ownership/warranty",
      "/dashboard/operations/compliance",
      "/dashboard/operations/compliance/eu",
      "/dashboard/operations",
      "/dashboard/analytics",
      "/dashboard/analytics/fraud",
      "/dashboard/system",
      "/dashboard/compliance",
      "/dashboard/compliance/eu",
      "/dashboard/scans/scan-analytics",
      "/dashboard/analytics/locations",
      "/dashboard/analytics/fraud",
      "/dashboard/analytics/geographic-insights",
      "/dashboard/integrations",
      "/dashboard/integrations/api-keys",
      "/dashboard/settings",
      "/dashboard/team",
      "/dashboard/print-labels",
      "/dashboard/system/documentation",
    ]
    for (const route of routes) {
      expect(isRouteResolvable(route), `Missing route page for ${route}`).toBe(
        true,
      )
    }
  })

  it("resolves key product-area navigation routes", () => {
    const routes = [
      "/dashboard/product-identity",
      "/dashboard/product-identity/passports",
      "/dashboard/product-identity/passports/create",
      "/dashboard/product-identity/qr-identity",
      "/dashboard/product-identity/qr-identity/batch",
      "/dashboard/product-identity/qr-identity/print",
      "/dashboard/product-identity/ownership",
      "/dashboard/product-identity/ownership/records",
      "/dashboard/product-identity/ownership/warranty",
      "/dashboard/product-identity/authenticity",
      "/dashboard/product-identity/authenticity/rules",
      "/dashboard/product-identity/authenticity/alerts",
    ]
    for (const route of routes) {
      expect(isRouteResolvable(route), `Missing route page for ${route}`).toBe(
        true,
      )
    }
  })

  it("resolves key operations navigation routes", () => {
    const routes = ["/dashboard/operations"]
    for (const route of routes) {
      expect(isRouteResolvable(route), `Missing route page for ${route}`).toBe(true)
    }
  })

  it("resolves key analytics and system hub routes", () => {
    const routes = ["/dashboard/analytics", "/dashboard/system"]
    for (const route of routes) {
      expect(isRouteResolvable(route), `Missing route page for ${route}`).toBe(true)
    }
  })
})
