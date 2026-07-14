export default function PrintLabelsLoading() {
  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-11rem)] w-[calc(100%+2rem)] flex-col sm:-mx-6 sm:w-[calc(100%+3rem)]">
      <div className="sticky top-0 z-40 shrink-0 border-b border-[#E7E2D7] bg-[#FCFBF8] px-4 py-3 sm:px-6">
        <div className="h-7 w-48 animate-pulse rounded bg-[#E7E2D7]" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[#F1EEE7]" />
        <div className="mt-4 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 flex-1 animate-pulse rounded-full bg-[#F1EEE7]" />
          ))}
        </div>
      </div>
      <div className="flex min-h-[min(72dvh,720px)] flex-1">
        <div className="hidden w-14 shrink-0 animate-pulse bg-[#F1EEE7] max-[1179px]:block min-[1180px]:w-56" />
        <div className="flex-1 animate-pulse bg-[#F7F4EE]" />
        <div className="hidden w-72 shrink-0 animate-pulse bg-[#F1EEE7] min-[860px]:block" />
      </div>
      <div className="h-16 shrink-0 animate-pulse border-t border-[#E7E2D7] bg-white" />
    </div>
  )
}
