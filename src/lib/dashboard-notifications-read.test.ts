import { describe, expect, it } from "vitest"
import { mergeNotificationReadFlags } from "./dashboard-notifications-read"

describe("dashboard-notifications-read", () => {
  it("mergeNotificationReadFlags marks ids present in the read set", () => {
    const items = [
      { id: "n1", isRead: false },
      { id: "n2", isRead: false },
    ]
    const out = mergeNotificationReadFlags(items, new Set(["n1"]))
    expect(out[0].isRead).toBe(true)
    expect(out[1].isRead).toBe(false)
  })
})
