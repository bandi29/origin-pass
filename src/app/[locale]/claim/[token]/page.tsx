import { ClaimOwnershipForm } from "@/components/ownership/ClaimOwnershipForm"

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function ClaimOwnershipPage({ params }: PageProps) {
  const { token } = await params

  return <ClaimOwnershipForm token={token} />
}
