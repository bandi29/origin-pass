import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { isValidUuid } from "@/lib/security"
import { PassportDetailView } from "@/components/passports/PassportDetailView"

type PageProps = {
  params: Promise<{ passport_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function PassportDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { passport_id } = await params
  const { tab } = await searchParams

  if (!isValidUuid(passport_id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const productIds = await getScopedProductIds(user.id)
  const admin = createAdminClient()

  const { data: passport, error } = await admin
    .from("passports")
    .select(
      "id, passport_uid, product_id, serial_number, verify_token, status, created_at, product:products(id,name)"
    )
    .eq("id", passport_id)
    .maybeSingle()

  if (error || !passport) notFound()

  const product = Array.isArray(passport.product)
    ? passport.product[0]
    : passport.product
  const productId = (passport as { product_id?: string }).product_id
  const productIdSet = new Set(productIds)
  if (!productId || !productIdSet.has(productId)) {
    notFound()
  }

  const { data: scans } = await admin
    .from("passport_scans")
    .select("id, scan_timestamp, location_country, location_city, device_type, scan_result")
    .eq("passport_id", passport_id)
    .order("scan_timestamp", { ascending: false })
    .limit(50)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  return (
    <PassportDetailView
      passport={{
        id: passport.id,
        passportUid: passport.passport_uid,
        productId: passport.product_id,
        productName: product?.name,
        serialNumber: passport.serial_number,
        verifyToken: (passport as { verify_token?: string | null }).verify_token ?? undefined,
        status: passport.status,
        createdAt: passport.created_at,
      }}
      scans={(scans ?? []) as Array<{
        id: string
        scan_timestamp: string
        location_country: string | null
        location_city: string | null
        device_type: string | null
        scan_result: string
      }>}
      defaultTab={tab ?? "overview"}
      baseUrl={baseUrl}
    />
  )
}
