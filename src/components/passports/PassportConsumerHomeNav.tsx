"use client"

import { Suspense } from "react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, X } from "lucide-react"
import { resolvePassportPublicHref } from "@/components/templates/passport-public-href"
import { isAdminPassportPreview } from "@/lib/public-passport-consumer"

type Props = {
  /** Server-detected preview flag from `?preview=true`. Client also reads the query string. */
  adminPreview?: boolean
  /** Deep link back to the embedded OriginPass app (Shopify Admin). */
  adminReturnHref?: string | null
  /** Brand https URL or `/` for marketing home — never a dashboard path. */
  publicHomeHref: string
  className?: string
}

function PassportConsumerHomeNavContent({
  adminPreview = false,
  adminReturnHref = null,
  publicHomeHref,
  className,
}: Props) {
  const searchParams = useSearchParams()
  const isPreview = adminPreview || isAdminPassportPreview(searchParams)

  if (isPreview) {
    if (adminReturnHref) {
      return (
        <a href={adminReturnHref} className={className}>
          <ArrowLeft className="mr-1 h-3 w-3" aria-hidden />
          Back to OriginPass
        </a>
      )
    }
    return (
      <button type="button" onClick={() => window.close()} className={className}>
        <X className="mr-1 h-3 w-3" aria-hidden />
        Close Preview
      </button>
    )
  }

  const isExternal =
    publicHomeHref.startsWith("http://") || publicHomeHref.startsWith("https://")
  const href = isExternal ? publicHomeHref : resolvePassportPublicHref("/")
  const label = isExternal ? "Brand Home" : "Home"

  return (
    <NextLink
      href={href}
      className={className}
      rel={isExternal ? "noopener noreferrer" : undefined}
    >
      <ArrowLeft className="mr-1 h-3 w-3" aria-hidden />
      {label}
    </NextLink>
  )
}

function PassportConsumerHomeNavFallback({ publicHomeHref, className }: Props) {
  const isExternal =
    publicHomeHref.startsWith("http://") || publicHomeHref.startsWith("https://")
  const href = isExternal ? publicHomeHref : resolvePassportPublicHref("/")
  const label = isExternal ? "Brand Home" : "Home"

  return (
    <NextLink
      href={href}
      className={className}
      rel={isExternal ? "noopener noreferrer" : undefined}
    >
      <ArrowLeft className="mr-1 h-3 w-3" aria-hidden />
      {label}
    </NextLink>
  )
}

export function PassportConsumerHomeNav(props: Props) {
  return (
    <Suspense fallback={<PassportConsumerHomeNavFallback {...props} />}>
      <PassportConsumerHomeNavContent {...props} />
    </Suspense>
  )
}
