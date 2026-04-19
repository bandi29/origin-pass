import clsx from "clsx"

type SkeletonProps = {
  className?: string
  /** line of text */
  lines?: number
}

export function Skeleton({ className, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={clsx("space-y-2", className)} aria-hidden>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-md bg-slate-200/90"
            style={{ width: i === lines - 1 ? "60%" : "100%" }}
          />
        ))}
      </div>
    )
  }
  return (
    <div
      className={clsx("animate-pulse rounded-xl bg-slate-200/90", className)}
      aria-hidden
    />
  )
}
