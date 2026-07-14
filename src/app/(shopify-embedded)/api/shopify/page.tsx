import { Suspense } from "react"
import ShopifyAppHomePage from "./app-home/page"

function ShopifyPageFallback() {
  return (
    <div className="min-h-screen bg-[#f6f6f7] px-5 py-8 font-sans text-[#202223]">
      <div className="mx-auto w-full max-w-2xl animate-pulse space-y-5">
        <div className="space-y-2">
          <div className="h-6 w-64 rounded bg-[#e3e3e3]" />
          <div className="h-4 w-full max-w-md rounded bg-[#ececec]" />
        </div>
        <div className="h-12 rounded-lg bg-[#ecfdf3]" />
        <div className="h-72 rounded-xl bg-white" />
        <div className="h-56 rounded-xl bg-white" />
      </div>
    </div>
  )
}

export default function ShopifyEmbeddedPage() {
  return (
    <Suspense fallback={<ShopifyPageFallback />}>
      <ShopifyAppHomePage />
    </Suspense>
  )
}
