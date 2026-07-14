"use client"

import { useState } from "react"
import NextLink from "next/link"
import { ArrowLeft, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react"
import { NarrowContainer } from "@/components/layout/Containers"
import { ConsumerScanTopBar } from "@/components/passports/ConsumerScanTopBar"
import { claimOwnershipAction } from "@/actions/claim-ownership"

type ClaimOwnershipFormProps = {
  token: string
  publicPassportPath: string
  brandHomeUrl?: string | null
  marketingHomeHref?: string
}

export function ClaimOwnershipForm({
  token,
  publicPassportPath,
  brandHomeUrl,
  marketingHomeHref,
}: ClaimOwnershipFormProps) {
  const [ownerIdentifier, setOwnerIdentifier] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
      setSuccess(true)
      return
    }

    setError(result.error ?? "Claim failed. Please try again.")
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <ConsumerScanTopBar brandHomeUrl={brandHomeUrl} marketingHomeHref={marketingHomeHref} />
      <NarrowContainer className="py-8">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {!success ? (
              <NextLink
                href={publicPassportPath}
                className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                Back to Passport
              </NextLink>
            ) : null}

            {success ? (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" strokeWidth={1.75} aria-hidden />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Ownership registered</h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Your ownership has been recorded. Warranty is active from today.
                  </p>
                </div>
                <NextLink
                  href={publicPassportPath}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  View Registered Passport
                </NextLink>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden />
                  </div>
                  <div className="min-w-0 text-left">
                    <h1 className="text-xl font-semibold text-slate-900">Claim Ownership</h1>
                    <p className="text-sm text-slate-500">
                      Register as the verified owner of this product.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {error}
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="ownerIdentifier" className="block text-sm font-medium text-slate-700">
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
                    <label htmlFor="ownerName" className="block text-sm font-medium text-slate-700">
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
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Claiming…
                      </span>
                    ) : (
                      "Claim Ownership"
                    )}
                  </button>
                </form>
              </>
            )}

            {!success ? (
              <p className="mt-4 text-xs text-slate-500">
                By claiming, you confirm you own this product. Warranty activates on first claim.
              </p>
            ) : null}
          </div>
        </div>
      </NarrowContainer>
    </div>
  )
}
