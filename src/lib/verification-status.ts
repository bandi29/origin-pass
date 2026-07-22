/** certificate_verification_status enum values in Postgres. */
export type CertificateVerificationStatus = "unverified" | "self_attested" | "third_party_verified"

export type VerificationPillTone = "neutral" | "evidence" | "verified" | "muted"

export type VerificationPillModel = {
  tone: VerificationPillTone
  label: string
  /** Short helper shown under the pill on public passport rows. */
  helper?: string
  /**
   * Shopper-facing wording. The merchant labels above are compliance-ops terms
   * ("self-attested", "evidence on file") that a QR-scanning consumer can't parse.
   */
  publicLabel: string
  publicHelper: string
}

/** Merchant + public copy for a field's verification state. */
export function verificationPillForField(options: {
  hasDocument: boolean
  status?: string | null
  evidenceScope?: "product" | "brand" | "none"
  scopeMismatch?: boolean
}): VerificationPillModel {
  if (!options.hasDocument) {
    return {
      tone: "muted",
      label: "No evidence on file",
      helper: "This claim is shown without supporting documentation.",
      publicLabel: "No document provided",
      publicHelper: "The brand hasn't attached a document supporting this claim.",
    }
  }

  if (options.scopeMismatch) {
    return {
      tone: "neutral",
      label: "Brand document on file",
      helper: "This brand-level document does not verify this product's own record.",
      publicLabel: "Brand-wide document",
      publicHelper: "This document covers the brand's range, so it doesn't confirm this item's own details.",
    }
  }

  if (options.status === "third_party_verified") {
    return {
      tone: "verified",
      label:
        options.evidenceScope === "brand"
          ? "Brand evidence · independently verified"
          : "Independently verified",
      helper:
        options.evidenceScope === "brand"
          ? "A third party attested the brand-wide supporting document."
          : "A third party has attested this supporting document.",
      publicLabel:
        options.evidenceScope === "brand" ? "Independently checked · brand-wide" : "Independently checked",
      publicHelper:
        options.evidenceScope === "brand"
          ? "An independent organisation checked the brand's document."
          : "An independent organisation checked this product's document.",
    }
  }

  if (options.status === "unverified") {
    return {
      tone: "neutral",
      label: "Document on file · unverified",
      helper: "Supporting documentation is attached but not yet reviewed.",
      publicLabel: "Document provided",
      publicHelper: "A document is attached, but it hasn't been independently checked.",
    }
  }

  return {
    tone: "evidence",
    label:
      options.evidenceScope === "brand"
        ? "Self-attested · brand evidence on file"
        : "Self-attested · evidence on file",
    helper:
      options.evidenceScope === "brand"
        ? "The brand attached documentation for its store-wide default."
        : "The brand has attached supporting documentation for this claim.",
    publicLabel: options.evidenceScope === "brand" ? "Brand-wide document" : "Brand-provided document",
    publicHelper:
      options.evidenceScope === "brand"
        ? "The brand attached a document covering its whole range."
        : "The brand attached a document supporting this claim.",
  }
}
