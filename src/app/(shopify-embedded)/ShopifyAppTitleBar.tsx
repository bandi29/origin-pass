"use client"

/**
 * Native App Bridge title bar — keeps the OriginPass app name in admin chrome
 * and surfaces overflow actions (top-right More actions / … menu).
 *
 * Home: title = "OriginPass" (matches Partners app name).
 * Nested: pass `title` + optional `breadcrumbHref` so merchants see
 * OriginPass › {page} with a working back link.
 *
 * Get Support uses mailto with target="_top" so the host admin can open the
 * mail client even when the app iframe is sandboxed.
 */
export function ShopifyAppTitleBar({
  title = "OriginPass",
  breadcrumbHref,
  breadcrumbLabel = "OriginPass",
}: {
  /** Page title in the admin title bar. Defaults to the app name. */
  title?: string
  /** When set, shows a breadcrumb back to this href (typically app home). */
  breadcrumbHref?: string
  breadcrumbLabel?: string
}) {
  return (
    <ui-title-bar title={title}>
      {/* `variant` / `label` are App Bridge title-bar attributes, not standard
          HTML — applied via cast so tsc accepts them. */}
      {breadcrumbHref ? (
        <a href={breadcrumbHref} {...({ variant: "breadcrumb" } as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {breadcrumbLabel}
        </a>
      ) : null}
      <section {...({ label: "More actions" } as React.HTMLAttributes<HTMLElement>)}>
        <a
          href="mailto:support@originpass.com?subject=OriginPass%20support%20%E2%80%94%20sync%20help"
          target="_top"
          rel="noopener noreferrer"
        >
          Get Support
        </a>
      </section>
    </ui-title-bar>
  )
}
