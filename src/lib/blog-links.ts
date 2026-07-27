/**
 * Client-safe blog URL helpers (no Node fs / Markdown deps).
 * Keep guide paths here so Shopify/dashboard UI can import them.
 */

export const BLOG_SITE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL ?? "https://origin-pass.vercel.app").replace(/\/$/, "")

/** Public guide routes (unprefixed; keep outside next-intl Link). */
export const BLOG_PATHS = {
  home: "/blog",
  espr: "/blog/eu-espr-compliance-shopify-apparel-brands",
  gs1: "/blog/gs1-digital-link-qr-code-clothing-hangtags",
} as const

export const BLOG_GUIDE_LINKS = [
  {
    key: "espr",
    label: "EU ESPR Compliance Guide",
    href: BLOG_PATHS.espr,
    shortLabel: "EU ESPR guide",
  },
  {
    key: "gs1",
    label: "GS1 QR Hangtag Tutorial",
    href: BLOG_PATHS.gs1,
    shortLabel: "GS1 QR hangtags",
  },
] as const

export function blogPostCanonical(slug: string): string {
  return `${BLOG_SITE_URL}/blog/${slug}`
}

export function blogIndexCanonical(): string {
  return `${BLOG_SITE_URL}/blog`
}

export function blogPostOgImage(slug: string): string {
  return `${BLOG_SITE_URL}/blog/${slug}/opengraph-image`
}

export function blogIndexOgImage(): string {
  return `${BLOG_SITE_URL}/blog/opengraph-image`
}

export function blogAbsolutePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${BLOG_SITE_URL}${normalized}`
}
