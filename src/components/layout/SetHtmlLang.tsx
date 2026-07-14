"use client"

import { useLayoutEffect } from "react"

type Props = { locale: string }

/**
 * Root layout uses a default `lang`; locale routes update `<html lang>` for a11y/SEO.
 */
export function SetHtmlLang({ locale }: Props) {
  useLayoutEffect(() => {
    const previous = document.documentElement.lang
    document.documentElement.lang = locale
    return () => {
      document.documentElement.lang = previous || "en"
    }
  }, [locale])

  return null
}
