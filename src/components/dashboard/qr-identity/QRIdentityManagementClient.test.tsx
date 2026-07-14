// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { QRIdentityManagementClient } from "./QRIdentityManagementClient"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, className, children }: { href: string; className?: string; children: ReactNode }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const emptyData = {
  metrics: [
    { id: "active", label: "Active QR Codes", value: "0", trend: "0%", status: "healthy" as const, sparkline: [0, 1, 0] },
    { id: "today", label: "Scans Today", value: "0", trend: "none", status: "healthy" as const, sparkline: [0, 2, 1, 3] },
    { id: "compromised", label: "Compromised QR Codes", value: "0", trend: "none", status: "healthy" as const, sparkline: [0] },
    { id: "pending", label: "Pending Activation", value: "0", trend: "none", status: "warning" as const, sparkline: [0] },
    { id: "successRate", label: "Verification Success Rate", value: "0%", trend: "none", status: "warning" as const, sparkline: [0] },
    { id: "avgRisk", label: "Avg Scan Risk Score", value: "0", trend: "none", status: "healthy" as const, sparkline: [0] },
  ],
  rows: [],
  recentPassports: [],
  recentActivity: [],
  scanSeries: [],
}

describe("QRIdentityManagementClient", () => {
  it("renders premium hero and empty state", () => {
    render(<QRIdentityManagementClient initialData={emptyData} />)
    expect(screen.getByText("QR Identity")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Generate secure product QR labels" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Create product passport" })).toBeInTheDocument()
  })

  it("filters rows by activation status and search", async () => {
    const user = userEvent.setup()
    render(
      <QRIdentityManagementClient
        initialData={{
          ...emptyData,
          rows: [
            {
              id: "1",
              qrCode: "QR-AAA",
              productId: "p1",
              productName: "Leather Bag",
              sku: "SKU-A",
              passportStatus: "active",
              activationStatus: "active",
              scanCount: 4,
              lastScanAt: null,
              riskScore: 12,
              ownershipState: "retailer",
              geoStatus: "stable",
              verifyUrl: "https://example.com/a",
            },
            {
              id: "2",
              qrCode: "QR-BBB",
              productId: "p2",
              productName: "Watch",
              sku: "SKU-B",
              passportStatus: "active",
              activationStatus: "compromised",
              scanCount: 2,
              lastScanAt: null,
              riskScore: 85,
              ownershipState: "customer",
              geoStatus: "high-risk",
              verifyUrl: "https://example.com/b",
            },
          ],
        }}
      />,
    )

    await user.selectOptions(screen.getByDisplayValue("All statuses"), "compromised")
    expect(screen.queryByRole("cell", { name: "Leather Bag" })).not.toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Watch" })).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText("Search by product, SKU, QR code..."))
    await user.type(screen.getByPlaceholderText("Search by product, SKU, QR code..."), "leather")
    expect(screen.queryByRole("cell", { name: "Watch" })).not.toBeInTheDocument()
  })
})
