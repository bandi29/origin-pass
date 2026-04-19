"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Loader2 } from "lucide-react"
import { completeOrganizationSignup } from "@/actions/complete-organization-signup"
import { authUi } from "@/components/auth/auth-ui"

export function OrganizationSetupForm() {
  const router = useRouter()
  const [organizationName, setOrganizationName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await completeOrganizationSignup(organizationName)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push("/dashboard")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${authUi.card} space-y-5`}>
      <div>
        <h1 className={authUi.title}>Finish setup</h1>
        <p className={authUi.subtitle}>
          Name your workspace. All product data is scoped to this organization.
        </p>
      </div>
      <div>
        <label htmlFor="org-name" className={authUi.label}>
          Brand / organization name
        </label>
        <input
          id="org-name"
          type="text"
          required
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          placeholder="e.g. Acme Atelier"
          className={authUi.input}
        />
      </div>
      {error && <div className={authUi.alertError}>{error}</div>}
      <button type="submit" disabled={loading} className={authUi.primaryBtn}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Go to dashboard"
        )}
      </button>
    </form>
  )
}
