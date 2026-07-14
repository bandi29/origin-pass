/** Persist which in-app (demo) notifications the user has opened — survives navigation and refresh. */
export const DASHBOARD_NOTIFICATIONS_READ_KEY = "originpass.dashboard.notifications.read.v1"

export function readStoredNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(DASHBOARD_NOTIFICATIONS_READ_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === "string" && x.length > 0))
  } catch {
    return new Set()
  }
}

export function storeNotificationReadIds(ids: Iterable<string>): void {
  if (typeof window === "undefined") return
  try {
    const merged = new Set(readStoredNotificationIds())
    for (const id of ids) {
      const t = id.trim()
      if (t) merged.add(t)
    }
    window.localStorage.setItem(DASHBOARD_NOTIFICATIONS_READ_KEY, JSON.stringify([...merged]))
  } catch {
    /* quota / private mode */
  }
}

export function mergeNotificationReadFlags<T extends { id: string; isRead: boolean }>(
  items: T[],
  readIds: Set<string>,
): T[] {
  return items.map((n) => (readIds.has(n.id) ? { ...n, isRead: true } : n))
}
