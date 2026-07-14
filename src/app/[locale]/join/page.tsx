import { Suspense } from "react"
import { JoinTeamClient } from "./JoinTeamClient"

export default async function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <JoinTeamClient />
    </Suspense>
  )
}
