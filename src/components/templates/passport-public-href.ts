import { routing } from "@/i18n/routing"

/**
 * Prefix internal app paths with the default locale so `/p/*` (no `[locale]` layout)
 * can deep-link into localized marketing and app routes.
 */
export function resolvePassportPublicHref(href: string): string {
  if (!href.startsWith("/")) return href
  for (const loc of routing.locales) {
    if (href === `/${loc}` || href.startsWith(`/${loc}/`)) return href
  }
  if (href === "/") return `/${routing.defaultLocale}`
  return `/${routing.defaultLocale}${href}`
}
