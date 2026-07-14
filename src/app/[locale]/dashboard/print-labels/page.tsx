import { redirect } from "@/i18n/navigation"

export default async function PrintLabelsAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const sp = await searchParams
  const q = new URLSearchParams()
  for (const key of ["batchId", "productId", "printSearch", "q"] as const) {
    const v = sp[key]
    const s = Array.isArray(v) ? v[0] : v
    const t = s?.trim()
    if (t) q.set(key === "q" ? "printSearch" : key, t)
  }
  const qs = q.toString()
  redirect({ href: `/dashboard/qr-identity/print${qs ? `?${qs}` : ""}`, locale })
  return null
}
