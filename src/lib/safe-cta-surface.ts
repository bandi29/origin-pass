import type { CSSProperties } from "react"

/** Matches `@theme` --color-primary — inline fallback when utility order is flaky */
export const SAFE_PRIMARY_BG = "#0f172a"
export const SAFE_PRIMARY_FG = "#ffffff"

export function safePrimarySurfaceStyle(): CSSProperties {
  return {
    backgroundColor: SAFE_PRIMARY_BG,
    color: SAFE_PRIMARY_FG,
    WebkitTextFillColor: SAFE_PRIMARY_FG,
  }
}
