"use client"

import NextLink from "next/link"
import { Link as I18nLink } from "@/i18n/navigation"
import { resolvePassportPublicHref } from "@/components/templates/passport-public-href"

type Props = {
  /** True on `/p/*` public passport pages (no next-intl provider). */
  passportPublicScan?: boolean
  href: string
  className?: string
  children: React.ReactNode
}

export function PassportNavLink({ passportPublicScan, href, className, children }: Props) {
  if (passportPublicScan) {
    const resolved = resolvePassportPublicHref(href)
    const external =
      resolved.startsWith("http://") || resolved.startsWith("https://")
    return (
      <NextLink
        href={resolved}
        className={className}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {children}
      </NextLink>
    )
  }
  return (
    <I18nLink href={href} className={className}>
      {children}
    </I18nLink>
  )
}
