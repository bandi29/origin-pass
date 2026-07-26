import { afterEach, describe, expect, it } from "vitest"
import {
  clearOAuthRedirects,
  oauthRedirectCount,
  OAUTH_LOOP_MAX_REDIRECTS,
  OAUTH_LOOP_WINDOW_MS,
  recentOAuthRedirects,
  registerOAuthRedirect,
  shouldBlockOAuthRedirect,
} from "./shopify-oauth-loop-guard"

/** In-memory Storage stand-in. */
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  }
}

/** Storage whose every method throws — models Safari/ITP blocking third-party storage. */
const throwingStorage: Storage = {
  length: 0,
  clear: () => {
    throw new Error("blocked")
  },
  getItem: () => {
    throw new Error("blocked")
  },
  key: () => {
    throw new Error("blocked")
  },
  removeItem: () => {
    throw new Error("blocked")
  },
  setItem: () => {
    throw new Error("blocked")
  },
}

describe("recentOAuthRedirects", () => {
  it("keeps only timestamps within the window", () => {
    const now = 1_000_000
    const stamps = [now, now - 1_000, now - (OAUTH_LOOP_WINDOW_MS - 1), now - OAUTH_LOOP_WINDOW_MS, now - 60_000]
    expect(recentOAuthRedirects(stamps, now)).toEqual([now, now - 1_000, now - (OAUTH_LOOP_WINDOW_MS - 1)])
  })

  it("drops future and non-finite timestamps", () => {
    const now = 1_000_000
    expect(recentOAuthRedirects([now + 5_000, NaN, Infinity, now], now)).toEqual([now])
  })
})

describe("shouldBlockOAuthRedirect", () => {
  it("blocks only once the recent count reaches the cap", () => {
    expect(shouldBlockOAuthRedirect(0)).toBe(false)
    expect(shouldBlockOAuthRedirect(OAUTH_LOOP_MAX_REDIRECTS - 1)).toBe(false)
    expect(shouldBlockOAuthRedirect(OAUTH_LOOP_MAX_REDIRECTS)).toBe(true)
  })
})

describe("redirect accounting (the loop scenario)", () => {
  afterEach(() => {
    /* each test builds its own storage */
  })

  it("does NOT block the happy path: one redirect, then connected clears it", () => {
    const storage = fakeStorage()
    const shop = "demo.myshopify.com"
    let now = 1_000_000

    // First load, store not connected → one redirect.
    expect(oauthRedirectCount(storage, shop, now)).toBe(0)
    const count = registerOAuthRedirect(storage, shop, now)
    expect(count).toBe(1)
    expect(shouldBlockOAuthRedirect(count)).toBe(false)

    // OAuth succeeds, store now connected → counter cleared.
    clearOAuthRedirects(storage)
    now += 2_000
    expect(oauthRedirectCount(storage, shop, now)).toBe(0)
  })

  it("blocks the loop: repeated bounces that never connect", () => {
    const storage = fakeStorage()
    const shop = "demo.myshopify.com"
    let now = 1_000_000
    const outcomes: boolean[] = []

    // Simulate the app re-mounting after each OAuth round-trip, still "not connected".
    for (let i = 0; i < 4; i++) {
      const priorCount = oauthRedirectCount(storage, shop, now)
      if (shouldBlockOAuthRedirect(priorCount)) {
        outcomes.push(true) // blocked
        continue
      }
      registerOAuthRedirect(storage, shop, now)
      outcomes.push(false) // redirected
      now += 3_000 // a fast OAuth round-trip
    }

    // Two redirects allowed, then blocked — never an infinite loop.
    expect(outcomes).toEqual([false, false, true, true])
  })

  it("does not block again after the window elapses", () => {
    const storage = fakeStorage()
    const shop = "demo.myshopify.com"
    const now = 1_000_000

    registerOAuthRedirect(storage, shop, now)
    registerOAuthRedirect(storage, shop, now)
    expect(shouldBlockOAuthRedirect(oauthRedirectCount(storage, shop, now))).toBe(true)

    const later = now + OAUTH_LOOP_WINDOW_MS + 1
    expect(oauthRedirectCount(storage, shop, later)).toBe(0)
    expect(shouldBlockOAuthRedirect(oauthRedirectCount(storage, shop, later))).toBe(false)
  })

  it("tracks shops independently", () => {
    const storage = fakeStorage()
    const now = 1_000_000
    registerOAuthRedirect(storage, "a.myshopify.com", now)
    registerOAuthRedirect(storage, "a.myshopify.com", now)
    expect(oauthRedirectCount(storage, "a.myshopify.com", now)).toBe(2)
    expect(oauthRedirectCount(storage, "b.myshopify.com", now)).toBe(0)
  })
})

describe("storage failure (blocked third-party storage)", () => {
  it("degrades safely: no throw, guard simply never fires", () => {
    const shop = "demo.myshopify.com"
    const now = 1_000_000
    // Must not throw even though every storage call throws.
    expect(() => registerOAuthRedirect(throwingStorage, shop, now)).not.toThrow()
    expect(oauthRedirectCount(throwingStorage, shop, now)).toBe(0)
    expect(() => clearOAuthRedirects(throwingStorage)).not.toThrow()
  })

  it("treats null storage (SSR) as empty", () => {
    expect(oauthRedirectCount(null, "demo.myshopify.com", 1)).toBe(0)
    expect(() => registerOAuthRedirect(null, "demo.myshopify.com", 1)).not.toThrow()
  })
})
