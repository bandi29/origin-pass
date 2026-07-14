import type { PassportTemplateKey } from "@/lib/passport-display-templates"
import { ClassicTheme } from "@/components/templates/ClassicTheme"
import { LuxuryTheme } from "@/components/templates/LuxuryTheme"
import type { PassportThemeProps } from "@/components/templates/passport-theme-types"

export function PassportPublicThemeView({
  templateKey,
  publicHomeHref = "/",
  brandHomeUrl = null,
  adminPreview = false,
  ...props
}: PassportThemeProps & { templateKey: PassportTemplateKey; adminPreview?: boolean }) {
  if (templateKey === "luxury") {
    return (
      <LuxuryTheme
        {...props}
        brandHomeUrl={brandHomeUrl}
        publicHomeHref={publicHomeHref}
        adminPreview={adminPreview}
        passportPublicScan
      />
    )
  }
  return (
    <ClassicTheme
      {...props}
      brandHomeUrl={brandHomeUrl}
      publicHomeHref={publicHomeHref}
      adminPreview={adminPreview}
      passportPublicScan
    />
  )
}
