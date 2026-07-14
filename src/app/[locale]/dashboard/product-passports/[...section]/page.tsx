import { PassportSectionView } from "@/components/passports/PassportSectionView"

export default async function PassportSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>
}) {
  const { section } = await params
  return <PassportSectionView sectionKey={section[0]} />
}
