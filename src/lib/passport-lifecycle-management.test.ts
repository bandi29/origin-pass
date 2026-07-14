import { describe, expect, it } from "vitest"
import {
  lifecycleConfirmKeywordMatches,
  passportLifecycleActionBlocked,
  PASSPORT_LIFECYCLE_TARGET_STATUS,
} from "@/lib/passport-lifecycle-management"

describe("passport-lifecycle-management", () => {
  it("requires exact confirmation keywords", () => {
    expect(lifecycleConfirmKeywordMatches("revoke", "revoke")).toBe(false)
    expect(lifecycleConfirmKeywordMatches("revoke", "REVOKE")).toBe(true)
    expect(lifecycleConfirmKeywordMatches("deactivate", "DEACTIVATE")).toBe(true)
    expect(lifecycleConfirmKeywordMatches("flag", "FLAG")).toBe(true)
  })

  it("maps lifecycle actions to passport statuses", () => {
    expect(PASSPORT_LIFECYCLE_TARGET_STATUS.deactivate).toBe("expired")
    expect(PASSPORT_LIFECYCLE_TARGET_STATUS.flag).toBe("counterfeit_flagged")
    expect(PASSPORT_LIFECYCLE_TARGET_STATUS.revoke).toBe("revoked")
  })

  it("blocks duplicate or invalid transitions", () => {
    expect(passportLifecycleActionBlocked("revoke", "revoked")).toMatch(/already/)
    expect(passportLifecycleActionBlocked("deactivate", "revoked")).toMatch(/cannot be changed/)
    expect(passportLifecycleActionBlocked("flag", "active")).toBeNull()
  })
})
