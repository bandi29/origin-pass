import { describe, expect, it, vi } from "vitest"
import {
  SUPPLIER_CERTIFICATE_ALLOWED_TYPES,
  SUPPLIER_CERTIFICATE_MAX_BYTES,
  SUPPLIER_CERTIFICATE_SIZE_ERROR,
  SUPPLIER_CERTIFICATE_TYPE_ERROR,
  supplierCertificateExtensionForMime,
} from "./supplier-certificate-upload-policy"
import {
  buildCertificateStorageFilename,
  certificateStoragePrefix,
  cleanupProductCertificateEvidence,
  deleteSupplierCertificate,
  deleteSupplierCertificateObject,
  extensionForUploadedCertificate,
  isCertificateObjectPathForStore,
  normalizeShopStorageId,
  parseSupplierCertificatePublicUrl,
  supplierCertificatePublicUrl,
  syncCertificateProofUrlToConfig,
} from "./supplier-certificates"

const SHOP = "originpass-sandbox.myshopify.com"
const STORE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
const PRODUCT_ID = "11111111-2222-3333-4444-555555555555"

describe("supplier-certificate-upload-policy", () => {
  it("allows PDF, PNG, and JPG mime types up to 5MB", () => {
    expect(SUPPLIER_CERTIFICATE_ALLOWED_TYPES).toEqual(
      expect.arrayContaining(["application/pdf", "image/png", "image/jpeg", "image/jpg"]),
    )
    expect(SUPPLIER_CERTIFICATE_MAX_BYTES).toBe(5 * 1024 * 1024)
    expect(supplierCertificateExtensionForMime("image/jpeg")).toBe("jpg")
    expect(supplierCertificateExtensionForMime("image/webp")).toBeNull()
    expect(SUPPLIER_CERTIFICATE_TYPE_ERROR).toMatch(/PDF, PNG, or JPG/)
    expect(SUPPLIER_CERTIFICATE_SIZE_ERROR).toMatch(/5MB/)
  })
})

describe("certificateStoragePrefix", () => {
  it("uses shop domain and field key for brand scope", () => {
    expect(certificateStoragePrefix(SHOP, "production_location")).toBe(
      `${SHOP}/production_location/`,
    )
  })

  it("includes product segment for product scope", () => {
    expect(certificateStoragePrefix(SHOP, "care_instructions", PRODUCT_ID)).toBe(
      `${SHOP}/product/${PRODUCT_ID}/care_instructions/`,
    )
  })
})

describe("isCertificateObjectPathForStore", () => {
  it("accepts shop-domain paths with uuid-prefixed filenames", () => {
    const path = `${SHOP}/production_location/550e8400-e29b-41d4-a716-446655440000-factory-cert.pdf`
    expect(isCertificateObjectPathForStore(path, SHOP, "production_location")).toBe(true)
  })

  it("accepts legacy store-id paths during migration", () => {
    const path = `${STORE_ID}/care_instructions/550e8400-e29b-41d4-a716-446655440000-scan.png`
    expect(isCertificateObjectPathForStore(path, SHOP, "care_instructions", null, STORE_ID)).toBe(true)
  })

  it("rejects paths outside tenant prefix", () => {
    const path = `other-shop.myshopify.com/production_location/550e8400-e29b-41d4-a716-446655440000.pdf`
    expect(isCertificateObjectPathForStore(path, SHOP, "production_location", null, STORE_ID)).toBe(false)
  })
})

describe("buildCertificateStorageFilename", () => {
  it("preserves a safe stem and extension", () => {
    const leaf = buildCertificateStorageFilename("Factory Audit Report (2026).pdf", "pdf")
    expect(leaf).toMatch(/^[0-9a-f-]{36}-Factory-Audit-Report-2026\.pdf$/)
  })
})

describe("extensionForUploadedCertificate", () => {
  it("falls back to filename when mime is empty", () => {
    expect(extensionForUploadedCertificate({ type: "", name: "proof.JPG" })).toBe("jpg")
    expect(extensionForUploadedCertificate({ type: "", name: "notes.txt" })).toBeNull()
  })
})

describe("supplierCertificatePublicUrl", () => {
  it("builds a public object URL for the bucket path", () => {
    const supabase = {
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/supplier-certificates/${path}`,
            },
          }),
        }),
      },
    } as never

    const path = `${normalizeShopStorageId(SHOP)}/production_location/550e8400-e29b-41d4-a716-446655440000-cert.pdf`
    expect(supplierCertificatePublicUrl(supabase, path)).toBe(
      `https://example.supabase.co/storage/v1/object/public/supplier-certificates/${path}`,
    )
  })
})

describe("parseSupplierCertificatePublicUrl", () => {
  const objectPath = `${SHOP}/production_location/550e8400-e29b-41d4-a716-446655440000-cert.pdf`
  const publicUrl = `https://abc.supabase.co/storage/v1/object/public/supplier-certificates/${objectPath}`

  it("parses standard public bucket URLs", () => {
    expect(parseSupplierCertificatePublicUrl(publicUrl)).toBe(objectPath)
  })

  it("parses short-form public object URLs", () => {
    expect(
      parseSupplierCertificatePublicUrl(
        `https://abc.supabase.co/object/public/supplier-certificates/${objectPath}`,
      ),
    ).toBe(objectPath)
  })

  it("accepts raw object keys", () => {
    expect(parseSupplierCertificatePublicUrl(objectPath)).toBe(objectPath)
    expect(parseSupplierCertificatePublicUrl(`/${objectPath}`)).toBe(objectPath)
  })

  it("returns null for unrelated URLs", () => {
    expect(parseSupplierCertificatePublicUrl("https://example.com/other.pdf")).toBeNull()
    expect(parseSupplierCertificatePublicUrl("")).toBeNull()
  })
})

describe("deleteSupplierCertificateObject", () => {
  it("removes parsed storage paths and swallows errors", async () => {
    const removed: string[] = []
    const supabase = {
      storage: {
        from: (bucket: string) => ({
          remove: async (paths: string[]) => {
            expect(bucket).toBe("supplier-certificates")
            removed.push(...paths)
            return { error: null }
          },
        }),
      },
    } as never

    const path = `${SHOP}/care_instructions/550e8400-e29b-41d4-a716-446655440000-scan.png`
    await deleteSupplierCertificateObject(
      supabase,
      `https://example.supabase.co/storage/v1/object/public/supplier-certificates/${path}`,
    )
    expect(removed).toEqual([path])
  })

  it("logs and continues when storage remove fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const supabase = {
      storage: {
        from: () => ({
          remove: async () => ({ error: { message: "object not found" } }),
        }),
      },
    } as never

    await expect(
      deleteSupplierCertificateObject(supabase, `${SHOP}/production_location/missing.pdf`),
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe("deleteSupplierCertificate", () => {
  it("deletes the certificate row even when storage removal fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    let rowDeleted = false
    const supabase = {
      storage: {
        from: () => ({
          remove: async () => ({ error: { message: "network error" } }),
        }),
      },
    } as never

    const cert = {
      id: "cert-1",
      file_path: `${SHOP}/production_location/550e8400-e29b-41d4-a716-446655440000-cert.pdf`,
    }

    Object.assign(supabase, {
      from: (table: string) => ({
        delete: () => ({
          eq: () => {
            if (table === "certificates") rowDeleted = true
            return Promise.resolve({ error: null })
          },
        }),
      }),
    })

    const result = await deleteSupplierCertificate(supabase, cert)
    expect(result).toEqual({ ok: true })
    expect(rowDeleted).toBe(true)
    errorSpy.mockRestore()
  })
})

describe("syncCertificateProofUrlToConfig", () => {
  it("clears orphaned storage when proof URL is nulled on brand config", async () => {
    const removed: string[] = []
    const oldUrl = `https://example.supabase.co/storage/v1/object/public/supplier-certificates/${SHOP}/production_location/old.pdf`
    const orgUpdates: Record<string, unknown>[] = []

    const supabase = {
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(...paths)
            return { error: null }
          },
        }),
      },
      from: (table: string) => {
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { production_location_proof_url: oldUrl },
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => ({
              eq: async () => {
                orgUpdates.push(payload)
                return { error: null }
              },
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    } as never

    await syncCertificateProofUrlToConfig(supabase, {
      storeId: STORE_ID,
      productId: null,
      fieldKey: "production_location",
      publicUrl: null,
    })

    expect(removed).toEqual([`${SHOP}/production_location/old.pdf`])
    expect(orgUpdates).toEqual([{ production_location_proof_url: null }])
  })
})

describe("cleanupProductCertificateEvidence", () => {
  it("deletes certificate row and storage on product field revert", async () => {
    const removed: string[] = []
    let certDeleted = false
    const filePath = `${SHOP}/product/${PRODUCT_ID}/care_instructions/550e8400-e29b-41d4-a716-446655440000-scan.png`

    const supabase = {
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(...paths)
            return { error: null }
          },
        }),
      },
      from: (table: string) => {
        if (table === "certificates") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { id: "cert-99", file_path: filePath },
                    }),
                  }),
                }),
              }),
            }),
            delete: () => ({
              eq: async () => {
                certDeleted = true
                return { error: null }
              },
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    } as never

    await cleanupProductCertificateEvidence(supabase, {
      storeId: STORE_ID,
      productId: PRODUCT_ID,
      fieldKey: "care_instructions",
    })

    expect(removed).toEqual([filePath])
    expect(certDeleted).toBe(true)
  })

  it("falls back to proof URL when no certificate row exists", async () => {
    const removed: string[] = []
    const proofUrl = `https://example.supabase.co/storage/v1/object/public/supplier-certificates/${SHOP}/product/${PRODUCT_ID}/production_location/orphan.pdf`

    const supabase = {
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(...paths)
            return { error: null }
          },
        }),
      },
      from: (table: string) => {
        if (table === "certificates") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null }),
                  }),
                }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    } as never

    await cleanupProductCertificateEvidence(supabase, {
      storeId: STORE_ID,
      productId: PRODUCT_ID,
      fieldKey: "production_location",
      proofUrl,
    })

    expect(removed).toEqual([`${SHOP}/product/${PRODUCT_ID}/production_location/orphan.pdf`])
  })
})
