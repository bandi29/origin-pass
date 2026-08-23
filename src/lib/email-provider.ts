/**
 * Lead-magnet subscriber registration.
 *
 * Deliberately thin: our code ONLY registers the subscriber against the right
 * list/tag. The provider dashboard owns the delivery email, the PDF attachment,
 * and the nurture sequence — so marketing can change copy without a deploy.
 *
 * No database, no auth, no subscriber storage on our side.
 *
 * Configure ONE provider via env:
 *   EMAIL_PROVIDER=kit
 *   KIT_API_KEY=...            # Kit (ConvertKit) v3 API key
 *   KIT_FORM_ID=...            # form whose automation sends the checklist
 *   KIT_TAG_ID=...             # optional numeric id of the `dpp-checklist` tag
 *
 *   EMAIL_PROVIDER=mailerlite
 *   MAILERLITE_API_KEY=...
 *   MAILERLITE_GROUP_ID=...    # group named `dpp-checklist`
 */

export type SubscribeOutcome =
  | { status: "subscribed" }
  | { status: "duplicate" }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string }

export type SubscribeInput = {
  email: string
  /** Explicit GDPR consent — callers must not invoke this without it. */
  consent: boolean
  /** Free-form source label stored on the subscriber record. */
  source?: string
}

/** Conservative RFC-ish check; the provider performs authoritative validation. */
export function isValidEmail(raw: string): boolean {
  const email = raw.trim()
  if (email.length < 5 || email.length > 254) return false
  if (/\s/.test(email)) return false
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email)
}

function providerName(): "kit" | "mailerlite" | null {
  const raw = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase()
  if (raw === "kit" || raw === "convertkit") return "kit"
  if (raw === "mailerlite") return "mailerlite"
  // Infer from whichever credentials are present.
  if (process.env.KIT_API_KEY) return "kit"
  if (process.env.MAILERLITE_API_KEY) return "mailerlite"
  return null
}

const TIMEOUT_MS = 8000

async function postJson(url: string, init: RequestInit): Promise<{ res: Response; body: unknown }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const text = await res.text().catch(() => "")
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { res, body }
}

function looksLikeDuplicate(body: unknown): boolean {
  const blob = JSON.stringify(body ?? "").toLowerCase()
  return blob.includes("already") || blob.includes("duplicate") || blob.includes("exists")
}

async function subscribeKit(input: SubscribeInput): Promise<SubscribeOutcome> {
  const apiKey = process.env.KIT_API_KEY
  const formId = process.env.KIT_FORM_ID
  if (!apiKey || !formId) {
    return { status: "error", message: "Email provider is not configured." }
  }

  const tagId = process.env.KIT_TAG_ID?.trim()
  const { res, body } = await postJson(`https://api.convertkit.com/v3/forms/${encodeURIComponent(formId)}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      email: input.email,
      ...(tagId ? { tags: [Number(tagId)].filter(Number.isFinite) } : {}),
      fields: {
        consent: input.consent ? "granted" : "none",
        consent_at: new Date().toISOString(),
        source: input.source ?? "dpp-checklist",
      },
    }),
  })

  if (res.ok) return { status: "subscribed" }
  if (looksLikeDuplicate(body)) return { status: "duplicate" }
  console.error("[lead-magnet] kit subscribe failed", res.status, JSON.stringify(body).slice(0, 300))
  return { status: "error", message: "Could not reach the mailing list. Please try again." }
}

async function subscribeMailerLite(input: SubscribeInput): Promise<SubscribeOutcome> {
  const apiKey = process.env.MAILERLITE_API_KEY
  const groupId = process.env.MAILERLITE_GROUP_ID
  if (!apiKey) {
    return { status: "error", message: "Email provider is not configured." }
  }

  const { res, body } = await postJson("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email: input.email,
      ...(groupId ? { groups: [groupId] } : {}),
      fields: { source: input.source ?? "dpp-checklist" },
      // MailerLite records opt-in metadata for GDPR evidence.
      opted_in_at: new Date().toISOString().slice(0, 19).replace("T", " "),
      status: "active",
    }),
  })

  if (res.ok) {
    // MailerLite returns 200 (existing) vs 201 (created); surface that difference.
    return res.status === 200 ? { status: "duplicate" } : { status: "subscribed" }
  }
  if (looksLikeDuplicate(body)) return { status: "duplicate" }
  console.error("[lead-magnet] mailerlite subscribe failed", res.status, JSON.stringify(body).slice(0, 300))
  return { status: "error", message: "Could not reach the mailing list. Please try again." }
}

/**
 * Register a lead-magnet subscriber. Never throws — always resolves to an
 * outcome the route can turn into a user-facing message.
 */
export async function subscribeLeadMagnet(input: SubscribeInput): Promise<SubscribeOutcome> {
  if (!input.consent) {
    return { status: "invalid", message: "Please tick the consent box so we can email you the checklist." }
  }
  if (!isValidEmail(input.email)) {
    return { status: "invalid", message: "That email address doesn't look right." }
  }

  const provider = providerName()
  if (!provider) return { status: "error", message: "Email provider is not configured." }

  try {
    return provider === "kit" ? await subscribeKit(input) : await subscribeMailerLite(input)
  } catch (err) {
    // Timeout / DNS / network — degrade gracefully, never 500 the page.
    console.error("[lead-magnet] subscribe threw:", err instanceof Error ? err.message : err)
    return { status: "error", message: "Network hiccup — please try again in a moment." }
  }
}
