import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { normalizePassportTemplateKey } from "@/lib/passport-display-templates"
import { PassportTemplateSelectionClient } from "@/components/passports/PassportTemplateSelectionClient"

export default async function PassportTemplatesSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("passport_template_key")
    .eq("id", user.id)
    .maybeSingle()

  const initialTemplateKey = normalizePassportTemplateKey(
    (profile as { passport_template_key?: string } | null)?.passport_template_key,
  )

  return (
    <div className={spacing.pageStack}>
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Passport templates</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Choose how your digital passport appears when customers scan a QR code. This applies to all products unless a
          product specifies its own template.
        </p>
      </div>

      <PassportTemplateSelectionClient initialTemplateKey={initialTemplateKey} />
    </div>
  )
}
