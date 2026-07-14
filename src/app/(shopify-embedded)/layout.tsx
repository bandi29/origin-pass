import type { ReactNode } from "react"
import { ShopifyEmbeddedRuntimeProbe } from "./ShopifyEmbeddedRuntimeProbe"

/**
 * Embedded admin shell. Title bar chrome is owned by App Bridge via
 * `<ui-title-bar>` (see ShopifyAppTitleBar) — do not CSS-hide it or the
 * native overflow menu (Get Support) will never appear.
 */
export default function ShopifyEmbeddedLayout({ children }: { children: ReactNode }) {
  return <ShopifyEmbeddedRuntimeProbe>{children}</ShopifyEmbeddedRuntimeProbe>
}
