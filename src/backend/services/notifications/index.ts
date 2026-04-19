export type VerificationNotification = {
  passportSerial: string
  verdict: "verified" | "not_found" | "suspicious" | "fraud"
  riskScore: number
}

export async function notifyOnSuspiciousScan(
  event: VerificationNotification
): Promise<void> {
  if (event.verdict !== "suspicious" && event.verdict !== "fraud") return
  // Placeholder integration point (email/Slack/webhook).
  console.warn("Suspicious scan notification:", event)
}
