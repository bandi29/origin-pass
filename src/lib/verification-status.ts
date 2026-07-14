/** certificate_verification_status enum values in Postgres. */
export type CertificateVerificationStatus = "unverified" | "self_attested" | "third_party_verified"

export type VerificationPillTone = "neutral" | "evidence" | "verified" | "muted"

export type VerificationPillModel = {
  tone: VerificationPillTone
  label: string
  /** Short helper shown under the pill on public passport rows. */
  helper?: string
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
    }
  }

  if (options.scopeMismatch) {
    return {
      tone: "neutral",
      label: "Brand document on file",
      helper: "This brand-level document does not verify this product's own record.",
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
    }
  }

  if (options.status === "unverified") {
    return {
      tone: "neutral",
      label: "Document on file · unverified",
      helper: "Supporting documentation is attached but not yet reviewed.",
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
  }
}
