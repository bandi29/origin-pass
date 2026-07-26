/**
 * Loop guard for the embedded app's automatic OAuth redirect.
 *
 * The admin home redirects to OAuth whenever it cannot confirm the store is
 * connected. If App Bridge cannot mint a session token (script blocked by an
 * extension, app opened non-embedded, init failure), the post-OAuth return still
 * reads "not connected" — so without a cap the app bounces through OAuth forever
 * and never opens. That is the classic embedded-app redirect loop, and exactly
 * the failure a reviewer's privacy tooling can surface.
 *
 * We record redirect timestamps per shop in sessionStorage and stop redirecting
 * once too many happen inside a short window, surfacing a recoverable error
 * instead. Pure decision logic is separated from storage so it is unit-testable.
 */

/** Redirects older than this are irrelevant — a genuine loop happens in seconds. */
export const OAUTH_LOOP_WINDOW_MS = 30_000
/** Allow this many OAuth bounces in the window before treating it as a loop. */
export const OAUTH_LOOP_MAX_REDIRECTS = 2

const STORAGE_KEY = "originpass:oauth-redirects"

/** sessionStorage may be absent (SSR) or throw (blocked) — never assume it works. */
type MaybeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null | undefined

/** Keep only redirect timestamps within the loop window of `now`. */
export function recentOAuthRedirects(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => Number.isFinite(t) && now - t >= 0 && now - t < OAUTH_LOOP_WINDOW_MS)
}

/** True once we've bounced too many times recently — stop, or it's an infinite loop. */
export function shouldBlockOAuthRedirect(recentCount: number): boolean {
  return recentCount >= OAUTH_LOOP_MAX_REDIRECTS
}

function readAll(storage: MaybeStorage): Record<string, number[]> {
  if (!storage) return {}
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number[]>) : {}
  } catch {
    return {}
  }
}

/** Recent (windowed) redirect count for `shop`, without recording a new one. */
export function oauthRedirectCount(storage: MaybeStorage, shop: string, now: number): number {
  return recentOAuthRedirects(readAll(storage)[shop] ?? [], now).length
}

/** Record a redirect for `shop` at `now`; returns the new recent count including it. */
export function registerOAuthRedirect(storage: MaybeStorage, shop: string, now: number): number {
  const all = readAll(storage)
  const next = [...recentOAuthRedirects(all[shop] ?? [], now), now]
  all[shop] = next
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* storage blocked — degrade to no persistence (guard simply won't fire) */
  }
  return next.length
}

/** Clear the counter once the store is genuinely connected (or on manual reload). */
export function clearOAuthRedirects(storage: MaybeStorage): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
