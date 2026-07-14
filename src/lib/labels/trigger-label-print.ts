/**
 * Opens the native browser print dialog without a pop-up window.
 * Must be invoked synchronously from a user click handler.
 */
export function triggerLabelPrintDialog(html: string): boolean {
  if (typeof document === "undefined") return false

  try {
    const iframe = document.createElement("iframe")
    iframe.setAttribute("title", "OriginPass label print")
    iframe.setAttribute("aria-hidden", "true")
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    })
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    const doc = iframe.contentDocument ?? win?.document
    if (!win || !doc) {
      iframe.remove()
      return false
    }

    doc.open()
    doc.write(html)
    doc.close()

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 500)
    }

    win.onafterprint = cleanup
    win.focus()
    win.print()
    window.setTimeout(cleanup, 60_000)
    return true
  } catch {
    return false
  }
}
