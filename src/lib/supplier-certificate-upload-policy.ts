/** Shared client/server validation for supplier certificate uploads. */
export const SUPPLIER_CERTIFICATE_MAX_BYTES = 5 * 1024 * 1024

export const SUPPLIER_CERTIFICATE_ALLOWED_MIME = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
} as const satisfies Record<string, "pdf" | "png" | "jpg">

export type SupplierCertificateExtension = (typeof SUPPLIER_CERTIFICATE_ALLOWED_MIME)[keyof typeof SUPPLIER_CERTIFICATE_ALLOWED_MIME]

export const SUPPLIER_CERTIFICATE_ACCEPT = Object.keys(SUPPLIER_CERTIFICATE_ALLOWED_MIME).join(",")

export const SUPPLIER_CERTIFICATE_ALLOWED_TYPES = Object.keys(SUPPLIER_CERTIFICATE_ALLOWED_MIME)

export const SUPPLIER_CERTIFICATE_TYPE_ERROR = "Only PDF, PNG, or JPG files are allowed."

export const SUPPLIER_CERTIFICATE_SIZE_ERROR = "That file is over the 5MB limit. Choose a smaller scan."

export function supplierCertificateExtensionForMime(mime: string): SupplierCertificateExtension | null {
  return (SUPPLIER_CERTIFICATE_ALLOWED_MIME as Record<string, SupplierCertificateExtension | undefined>)[mime] ?? null
}
