import { createAdminClient } from "@/lib/supabase/admin"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import { extractBrandHomeUrlFromMetadata } from "@/lib/public-passport-consumer"
import { ClaimOwnershipForm } from "@/components/ownership/ClaimOwnershipForm"

type PageProps = {
  params: Promise<{ token: string; locale: string }>
}

export default async function ClaimOwnershipPage({ params }: PageProps) {
  const { token, locale } = await params

  const passportRow = await findPassportByTokenOrSerial(token)
  let brandHomeUrl: string | null = null

  if (passportRow) {
    const admin = createAdminClient()
    const { data: passportRowMeta } = await admin
      .from("passports")
      .select("metadata")
      .eq("id", passportRow.id)
      .maybeSingle()

    const { data: productRowMeta } = passportRow.product_id
      ? await admin
          .from("products")
          .select("metadata")
          .eq("id", passportRow.product_id)
          .maybeSingle()
      : { data: null }

    brandHomeUrl = extractBrandHomeUrlFromMetadata(
      passportRowMeta?.metadata,
      productRowMeta?.metadata ?? null,
    )
  }

  const publicPassportPath = `/p/${encodeURIComponent(token)}`

  return (
    <ClaimOwnershipForm
      token={token}
      brandHomeUrl={brandHomeUrl}
      publicPassportPath={publicPassportPath}
      marketingHomeHref={`/${locale}`}
    />
  )
}
