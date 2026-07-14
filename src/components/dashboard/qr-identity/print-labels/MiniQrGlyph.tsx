"use client"

/** Decorative QR glyph for studio previews when no scan URL is available. */
export function MiniQrGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className ?? "mx-auto block h-[54px] w-[54px]"} aria-hidden>
      <rect width="100" height="100" fill="#fff" />
      <g fill="#0E1B2A">
        <rect x="6" y="6" width="26" height="26" rx="3" />
        <rect x="12" y="12" width="14" height="14" rx="2" fill="#fff" />
        <rect x="16" y="16" width="6" height="6" />
        <rect x="68" y="6" width="26" height="26" rx="3" />
        <rect x="74" y="12" width="14" height="14" rx="2" fill="#fff" />
        <rect x="78" y="16" width="6" height="6" />
        <rect x="6" y="68" width="26" height="26" rx="3" />
        <rect x="12" y="74" width="14" height="14" rx="2" fill="#fff" />
        <rect x="16" y="78" width="6" height="6" />
        <rect x="42" y="6" width="6" height="6" />
        <rect x="52" y="14" width="6" height="6" />
        <rect x="42" y="22" width="6" height="6" />
        <rect x="42" y="42" width="6" height="6" />
        <rect x="54" y="42" width="6" height="6" />
        <rect x="66" y="42" width="6" height="6" />
        <rect x="78" y="48" width="6" height="6" />
        <rect x="42" y="54" width="6" height="6" />
        <rect x="42" y="66" width="6" height="6" />
        <rect x="54" y="60" width="6" height="6" />
        <rect x="66" y="66" width="6" height="6" />
        <rect x="42" y="78" width="6" height="6" />
        <rect x="54" y="84" width="6" height="6" />
        <rect x="78" y="78" width="6" height="6" />
        <rect x="88" y="66" width="6" height="6" />
      </g>
    </svg>
  )
}
