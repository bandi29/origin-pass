import { PUBLIC_PASSPORT_LANG_OPTIONS } from "@/lib/passport-eu-lang"

type Props = {
  /** Absolute canonical passport URL without query (e.g. https://origin-pass.vercel.app/p/TOKEN). */
  canonicalUrl: string
}

/**
 * SEO alternate language links for public passport pages.
 * Renders `<link rel="alternate" hreflang="…" />` for EN + EU langs + x-default.
 */
export function PassportHreflangLinks({ canonicalUrl }: Props) {
  const base = canonicalUrl.split("?")[0]?.replace(/\/$/, "") || canonicalUrl
  return (
    <>
      {PUBLIC_PASSPORT_LANG_OPTIONS.map((opt) => (
        <link
          key={opt.code}
          rel="alternate"
          hrefLang={opt.hreflang}
          href={`${base}?lang=${opt.code}`}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={base} />
    </>
  )
}
