import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const mustExist = [
  "src/app/api/qr/generate/route.ts",
  "src/app/api/qr/batch-generate/route.ts",
  "src/app/api/qr/activate/route.ts",
  "src/app/api/qr/revoke/route.ts",
  "src/app/api/qr/analytics/route.ts",
  "src/app/api/qr/[id]/route.ts",
  "src/app/[locale]/dashboard/qr-identity/page.tsx",
  "src/app/[locale]/dashboard/qr-identity/all/page.tsx",
  "src/app/[locale]/dashboard/qr-identity/batch/page.tsx",
  "src/app/[locale]/dashboard/qr-identity/print/page.tsx",
  "src/app/[locale]/dashboard/qr-identity/verification/page.tsx",
]

describe("QR identity route coverage", () => {
  it("keeps all QR module routes resolvable", () => {
    for (const rel of mustExist) {
      expect(existsSync(path.join(root, rel)), `Missing route file: ${rel}`).toBe(true)
    }
  })
})
