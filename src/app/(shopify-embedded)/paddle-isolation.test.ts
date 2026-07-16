import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const EMBEDDED_ROOT = join(process.cwd(), "src/app/(shopify-embedded)")

const FORBIDDEN = [
  /from\s+["']@\/lib\/paddle["']/,
  /from\s+["']@\/lib\/paddle-webhook["']/,
  /from\s+["']@paddle\//,
  /require\(\s*["']@\/lib\/paddle["']\s*\)/,
  /require\(\s*["']@paddle\//,
]

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkFiles(full, out)
      continue
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full)
    }
  }
  return out
}

describe("Paddle isolation from Shopify Admin", () => {
  it("does not import Paddle from (shopify-embedded)", () => {
    const files = walkFiles(EMBEDDED_ROOT)
    expect(files.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) {
          violations.push(`${relative(process.cwd(), file)} matches ${pattern}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
