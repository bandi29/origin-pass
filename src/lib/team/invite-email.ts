import { siteUrl } from "@/lib/marketing"

export function buildTeamInviteEmailHtml(params: {
  organizationName: string
  inviterName: string
  acceptUrl: string
  expiresAtIso: string
  optionalMessage?: string | null
}): string {
  const exp = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(
    new Date(params.expiresAtIso),
  )
  const msg = params.optionalMessage?.trim()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Team invitation</title>
</head>
<body style="margin:0;background:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(15,23,42,0.35);">
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:600;">OriginPass</div>
              <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.25;color:#0f172a;">You’re invited to <span style="color:#2563eb;">${escapeHtml(
                params.organizationName,
              )}</span></h1>
              <p style="margin:14px 0 0 0;font-size:15px;line-height:1.6;color:#475569;">
                <strong>${escapeHtml(params.inviterName)}</strong> invited you to collaborate on product authenticity, passports, and verification workflows.
              </p>
              ${
                msg
                  ? `<p style="margin:14px 0 0 0;padding:12px 14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;font-size:14px;line-height:1.55;color:#334155;">${escapeHtml(
                      msg,
                    )}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px 28px;">
              <a href="${escapeAttr(params.acceptUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 22px;border-radius:12px;">
                Accept invitation
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                This link expires on <strong>${escapeHtml(exp)}</strong>. If you did not expect this email, you can ignore it.
              </p>
              <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#94a3b8;word-break:break-all;">
                ${escapeHtml(params.acceptUrl)}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;">© OriginPass · ${escapeHtml(siteUrl())}</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;")
}

export async function sendTeamInviteEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const webhook = process.env.TEAM_INVITE_EMAIL_WEBHOOK_URL?.trim()
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: params.to, subject: params.subject, html: params.html }),
      })
      if (!res.ok) return { ok: false, error: `Webhook responded ${res.status}` }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Webhook failed" }
    }
  }
  console.info("[team-invite] TEAM_INVITE_EMAIL_WEBHOOK_URL not set; invite email skipped for", params.to)
  return { ok: true }
}
