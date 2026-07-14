import { redirect } from "@/i18n/navigation"

type PageProps = { params: Promise<{ locale: string }> }

export default async function SettingsTeamPage({ params }: PageProps) {
  const { locale } = await params
  redirect({ href: "/dashboard/team", locale })
  return null
}
