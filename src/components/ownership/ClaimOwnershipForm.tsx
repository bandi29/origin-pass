"use client"

import { useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react"
import { NarrowContainer } from "@/components/layout/Containers"
import { claimOwnershipAction } from "@/actions/claim-ownership"

type ClaimOwnershipFormProps = {
  token: string
}

export function ClaimOwnershipForm({ token }: ClaimOwnershipFormProps) {
  const [ownerIdentifier, setOwnerIdentifier] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await claimOwnershipAction({
      tokenOrSerial: token,
      ownerIdentifier: ownerIdentifier.trim(),
      ownerName: ownerName.trim() || undefined,
    })

    setLoading(false)

    if (result.success) {
      router.push("/ownership/success")
      return
    }

    setError(result.error ?? "Claim failed. Please try again.")
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <NarrowContainer className="py-8">
        <div className="mx-auto max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Claim Ownership
                </h1>
                <p className="text-sm text-slate-500">
                  Register as the verified owner of this product.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="ownerIdentifier"
                  className="block text-sm font-medium text-slate-700"
                >
                  Email or phone *
                </label>
                <input
                  id="ownerIdentifier"
                  type="text"
                  inputMode="email"
                  placeholder="you@example.com or +1234567890"
                  value={ownerIdentifier}
                  onChange={(e) => setOwnerIdentifier(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>

              <div>
                <label
                  htmlFor="ownerName"
                  className="block text-sm font-medium text-slate-700"
                >
                  Name (optional)
                </label>
                <input
                  id="ownerName"
                  type="text"
                  placeholder="Your name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !ownerIdentifier.trim()}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming…
                  </span>
                ) : (
                  "Claim Ownership"
                )}
              </button>
            </form>

            <p className="mt-4 text-xs text-slate-500">
              By claiming, you confirm you own this product. Warranty activates on
              first claim.
            </p>
          </div>
        </div>
      </NarrowContainer>
    </main>
  )
}
