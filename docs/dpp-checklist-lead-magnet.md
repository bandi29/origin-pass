# DPP Checklist Lead Magnet — Setup Guide

Everything the code does, and everything **you** still need to configure in the email provider.

- **Page:** `/dpp-checklist` (English, outside `[locale]`, canonical `https://origin-pass.vercel.app/dpp-checklist`)
- **PDF:** `public/downloads/eu-textile-dpp-readiness-checklist.pdf` — regenerate with
  `npx tsx scripts/generate-dpp-checklist-pdf.mts`
- **API:** `POST /api/lead-magnet/subscribe` → registers the subscriber only
- **No database, no auth, no subscriber storage on our side.**

---

## 1. Environment variables

Pick **one** provider and set its vars in Vercel (Production + Preview) and `.env.local`.

### Option A — Kit (ConvertKit)
```bash
EMAIL_PROVIDER=kit
KIT_API_KEY=your_v3_api_key         # Kit → Settings → Advanced → API
KIT_FORM_ID=1234567                 # the form whose automation delivers the PDF
KIT_TAG_ID=7654321                  # optional: numeric id of the `dpp-checklist` tag
```

### Option B — MailerLite
```bash
EMAIL_PROVIDER=mailerlite
MAILERLITE_API_KEY=your_api_key     # MailerLite → Integrations → API
MAILERLITE_GROUP_ID=123456789       # id of the group named `dpp-checklist`
```

> Until one of these is set the form returns a clean *"Email provider is not configured"* error — the page still renders and the PDF still downloads.

---

## 2. Provider dashboard checklist

### A. Create the audience container
- **Kit:** create a **Form** (Incentive-style). Create a **Tag** named `dpp-checklist`. Copy the form ID and tag ID into the env vars.
- **MailerLite:** create a **Group** named `dpp-checklist`. Copy its ID.

### B. PDF delivery automation
1. Upload `eu-textile-dpp-readiness-checklist.pdf` to the provider's file/asset library
   *(or link to `https://origin-pass.vercel.app/downloads/eu-textile-dpp-readiness-checklist.pdf` — the file is publicly served)*.
2. Build the automation:
   - **Kit:** Automations → Visual Automation → Trigger **"Joins a form"** → Action **Send email** (the delivery email below, with the PDF attached or linked).
   - **MailerLite:** Automations → New → Trigger **"When subscriber joins a group"** → Email step.
3. Send **immediately** (no delay) on this first email.

### C. Nurture sequence timing
Add three follow-up emails to the same automation, delays measured **from signup**:

| Email | Delay after signup | Subject |
|---|---|---|
| Delivery | Immediate | Your EU Textile DPP Readiness Checklist |
| Nurture 1 | **3 days** | The mistake most brands make with DPP |
| Nurture 2 | **7 days** (4 days after #1) | Will a spreadsheet be enough for DPP? |
| Nurture 3 | **12 days** (5 days after #2) | How OriginPass handles verified passports |

> Most builders use *relative* delays between steps — so enter **3 days**, then **4 days**, then **5 days** to land on days 3 / 7 / 12.

In **Nurture 3**, replace `[app link]` with your live Shopify App Store URL.

### D. Domain verification (do this before sending)
- Add the provider's **SPF**, **DKIM**, and (recommended) **DMARC** records to your sending domain's DNS.
- Set the **From** address to a real mailbox on that domain (e.g. `hello@yourdomain.com`) — not a `@gmail.com`.
- Verify a **reply-to** you actually monitor: the delivery email promises "a real person reads these."
- Send a test to Gmail + Outlook and confirm inbox placement before publishing the page.

### E. Consent & GDPR settings
- Our form **blocks submission until the consent box is ticked**, and the API rejects any request without `consent: true`.
- We pass consent metadata to the provider (`consent: granted`, `consent_at` timestamp for Kit; `opted_in_at` for MailerLite) so you hold an opt-in record.
- In the provider: enable **double opt-in** if you want a second confirmation layer (recommended for EU audiences), include a visible **unsubscribe** link, and set your **physical postal address** in the email footer (required by CAN-SPAM and good practice for GDPR).
- Add a link to your privacy policy in the footer of each email.

---

## 3. Email copy — paste into the provider

### Delivery email — send immediately
**Subject:** `Your EU Textile DPP Readiness Checklist`

```
Hi there,

Thanks for grabbing the checklist — it's attached as a PDF.

The single most important thing it covers: start collecting supplier data now.
It's the longest-lead-time part of DPP readiness, and the piece most brands
underestimate. Everything else (QR codes, the passport itself) is fast once the
data exists.

Work through the five phases at your own pace. If you get stuck, just reply — a
real person reads these.

When you reach the point of generating passports from your data, that's what we
build. OriginPass creates verified, audit-ready product passports inside Shopify
— including attaching supplier evidence to each claim. No pressure now; the
checklist stands on its own.

— SentientApps, OriginPass
```

### Nurture 1 — Day 3
**Subject:** `The mistake most brands make with DPP`

```
Most brands assume DPP is about generating the passport. It isn't — that part's
easy. The hard part is collecting data from your suppliers and being able to
prove it. Carbon figures, recycled content, origin per production step — most of
it lives upstream, and gathering it takes months.

If you do one thing this month, make it supplier outreach.

(Reply if you want the supplier-request template I use.)
```

### Nurture 2 — Day 7
**Subject:** `Will a spreadsheet be enough for DPP?`

```
Short answer: for early data inventory, yes.

But a spreadsheet breaks at two points — when you need to attach evidence to
each claim (a certificate behind "70% recycled"), and when different parties
(regulators, recyclers) need different access to the same product's data.

That's the moment brands move to a real tool. Worth knowing where that line is
before you hit it.
```

### Nurture 3 — Day 12
**Subject:** `How OriginPass handles verified passports`

```
Quick one.

When you're ready, here's what OriginPass does: generates the passport inside
Shopify, and lets you attach a supplier certificate to each claim — so the
passport doesn't just say "made in Italy," it can prove it.

That evidence layer is what makes a passport survive an audit.

If that's useful, you can try it here: [app link]

Either way, glad the checklist helped.
```

---

## 4. Post-launch verification

- [ ] Submit the live form with a real address; confirm the subscriber appears with the `dpp-checklist` tag/group.
- [ ] Confirm the delivery email arrives with a working PDF.
- [ ] Submit the **same** address again — you should see the "already on the list" message, not an error.
- [ ] Submit with consent **unticked** — the button stays disabled.
- [ ] Run the page through [Google Rich Results Test](https://search.google.com/test/rich-results) to confirm the FAQ schema is detected.
- [ ] Submit `https://origin-pass.vercel.app/dpp-checklist` in Google Search Console.
- [ ] Add the page to your sitemap if `src/app/sitemap.ts` doesn't pick it up automatically.
