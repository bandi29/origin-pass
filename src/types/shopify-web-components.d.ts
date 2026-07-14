import type { DetailedHTMLProps, HTMLAttributes, ReactNode } from "react"

/**
 * JSX typings for the Shopify-native custom elements we render in the embedded
 * admin: Polaris web components (`s-*`) loaded with App Bridge, and the App
 * Bridge UI components (`ui-*`). Props are permissive because these elements
 * accept arbitrary attributes at runtime; we only need `tsc` to accept them.
 */
type CustomElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  [attr: string]: unknown
  children?: ReactNode
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": CustomElement
      "s-section": CustomElement
      "s-card": CustomElement
      "s-box": CustomElement
      "s-stack": CustomElement
      "s-text": CustomElement
      "s-heading": CustomElement
      "s-paragraph": CustomElement
      "s-text-field": CustomElement
      "s-banner": CustomElement
      "s-button": CustomElement
      "ui-save-bar": CustomElement
      "ui-nav-menu": CustomElement
      "ui-title-bar": CustomElement
    }
  }
}

/** Minimal shape of the App Bridge `shopify` global available in embedded apps. */
type ShopifyAppBridge = {
  idToken: () => Promise<string>
  toast: { show: (message: string, options?: { duration?: number; isError?: boolean }) => void }
  saveBar: { show: (id: string) => Promise<void>; hide: (id: string) => Promise<void> }
  config?: { shop?: string; host?: string }
}

declare global {
  // App Bridge injects this on the window in embedded contexts.
  var shopify: ShopifyAppBridge | undefined
}

export {}
