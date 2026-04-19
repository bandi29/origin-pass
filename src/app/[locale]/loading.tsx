/**
 * Route-level loading UI: stable dimensions matching the marketing hero (headline column + Verified card)
 * to reduce layout shift during client navigations.
 */
export default function LocaleLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Mirrors SiteHeader / Shell h-16 + container */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" aria-hidden />
          <div className="flex items-center gap-3">
            <div className="hidden h-8 w-40 animate-pulse rounded-md bg-slate-100 lg:block" aria-hidden />
            <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" aria-hidden />
          </div>
        </div>
      </header>

      <main className="flex min-w-0 flex-1 flex-col">
        <section className="bg-white pt-20 pb-10">
          <div className="mx-auto w-full max-w-[1200px] min-w-0 px-6">
            <div className="flex w-full flex-col gap-6">
              <div className="grid min-h-[500px] w-full grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
                {/* Left: headline block — matches marketing-hero-title (56px / 36px mobile) + lead + image strip + CTAs */}
                <div className="flex min-h-0 min-w-0 flex-col justify-center text-center lg:max-w-xl lg:text-left">
                  <div className="flex min-h-0 min-w-0 flex-col gap-6">
                    <div className="mx-auto h-3 w-48 animate-pulse rounded-full bg-slate-200 lg:mx-0" aria-hidden />
                    {/* Two-line title: ~56px line-height ×2 on lg, ~36px ×2 on mobile */}
                    <div className="flex w-full max-w-[520px] flex-col gap-3 lg:max-w-none">
                      <div className="mx-auto h-9 w-full max-w-md animate-pulse rounded-md bg-slate-200 lg:mx-0 lg:h-14" aria-hidden />
                      <div className="mx-auto h-9 w-full max-w-sm animate-pulse rounded-md bg-slate-200 lg:mx-0 lg:h-14" aria-hidden />
                    </div>
                    <div className="mx-auto h-12 w-full max-w-lg animate-pulse rounded-md bg-slate-100 lg:mx-0" aria-hidden />
                  </div>
                  {/* Hero image region — matches aspect-[800/420] max-w-lg */}
                  <div
                    className="mx-auto mt-6 aspect-[800/420] w-full max-w-lg animate-pulse rounded-2xl bg-slate-100 lg:mx-0"
                    aria-hidden
                  />
                  <div className="cta-row mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="mx-auto h-12 w-full max-w-[200px] animate-pulse rounded-xl bg-slate-300 sm:mx-0" aria-hidden />
                    <div className="mx-auto h-12 w-full max-w-[140px] animate-pulse rounded-xl bg-slate-100 sm:mx-0" aria-hidden />
                  </div>
                </div>

                {/* Right: Verified authentic card — max-w-[440px], ~min-h for inner sections */}
                <div className="flex h-full w-full items-center justify-center lg:justify-end">
                  <div
                    className="flex w-full max-w-[440px] min-h-[380px] flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                    aria-hidden
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                        <div className="flex flex-wrap gap-2">
                          <div className="h-6 w-16 animate-pulse rounded-md bg-slate-100" />
                          <div className="h-6 w-24 animate-pulse rounded-md bg-slate-100" />
                        </div>
                        <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
                        <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
                      </div>
                      <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                    </div>
                    <div className="mt-6 flex-1 rounded-2xl bg-slate-50 p-6">
                      <div className="space-y-2">
                        <div className="h-3 w-full animate-pulse rounded bg-slate-200/80" />
                        <div className="h-3 w-[92%] animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-[80%] animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-slate-200" />
                      <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                </div>
              </div>

              <ul className="m-0 mt-6 flex list-none flex-col items-center gap-4 p-0 sm:flex-row sm:justify-center lg:justify-start">
                <li className="h-5 w-40 animate-pulse rounded bg-slate-100" aria-hidden />
                <li className="h-5 w-32 animate-pulse rounded bg-slate-100" aria-hidden />
                <li className="h-5 w-36 animate-pulse rounded bg-slate-100" aria-hidden />
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
