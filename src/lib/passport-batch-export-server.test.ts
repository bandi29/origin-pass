import { describe, expect, it, vi } from "vitest"
import { jobLabelCount } from "@/lib/passport-batch-export-resolver"
import type { BatchJobForExport, BatchJobMetadata } from "@/lib/passport-batch-export-resolver"

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from("png-bytes")),
  },
}))

vi.mock("jszip", () => {
  const instances: Array<{ files: Record<string, Buffer> }> = []
  class MockZip {
    files: Record<string, Buffer> = {}
    constructor() {
      instances.push(this)
    }
    file(name: string, data: Buffer) {
      this.files[name] = data
    }
    async generateAsync() {
      return new Uint8Array([1, 2, 3])
    }
    static lastInstance() {
      return instances[instances.length - 1] ?? null
    }
    static reset() {
      instances.length = 0
    }
  }
  return { default: MockZip }
})

import JSZip from "jszip"
import { buildPassportLabelsZip, resolvePassportIdsForJob } from "@/lib/passport-batch-export-server"

const MockZip = JSZip as unknown as {
  new (): { files: Record<string, Buffer> }
  lastInstance(): { files: Record<string, Buffer> } | null
  reset(): void
}

const batchOneIds = [
  "11111111-1111-1111-1111-111111111101",
  "11111111-1111-1111-1111-111111111102",
  "11111111-1111-1111-1111-111111111103",
]

const batchTwoIds = [
  "22222222-2222-2222-2222-222222222201",
  "22222222-2222-2222-2222-222222222202",
  "22222222-2222-2222-2222-222222222203",
]

const jobOne: BatchJobForExport = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  organization_id: "org-1",
  created_by: "user-1",
  started_at: "2026-05-20T00:00:00.000Z",
  completed_at: "2026-05-20T00:00:05.000Z",
  input_count: 3,
  success_count: 3,
}

const jobTwo: BatchJobForExport = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  organization_id: "org-1",
  created_by: "user-1",
  started_at: "2026-05-20T01:00:00.000Z",
  completed_at: "2026-05-20T01:00:05.000Z",
  input_count: 3,
  success_count: 3,
}

function row(id: string, jobId: string | null, createdAt: string) {
  return {
    id,
    created_at: createdAt,
    product_id: "product-1",
    metadata: jobId ? { qr_batch_job_id: jobId } : {},
  }
}

function createMockAdmin(passports: ReturnType<typeof row>[]) {
  const byId = new Map(passports.map((passport) => [passport.id, passport]))

  const filterRows = (predicate: (passport: ReturnType<typeof row>) => boolean) =>
    passports.filter(predicate)

  const chain = (rows: ReturnType<typeof row>[]) => {
    const api = {
      eq: () => api,
      in: (_column: string, values: string[]) =>
        chain(rows.filter((passport) => values.includes(String(passport.product_id)))),
      gte: (_column: string, since: string) =>
        chain(
          filterRows(
            (passport) => new Date(passport.created_at).getTime() >= new Date(since).getTime(),
          ),
        ),
      lte: (_column: string, until: string) =>
        chain(
          filterRows(
            (passport) => new Date(passport.created_at).getTime() <= new Date(until).getTime(),
          ),
        ),
      order: () => api,
      limit: () => Promise.resolve({ data: rows, error: null }),
      filter: () => api,
    }
    return api
  }

  return {
    from: (table: string) => {
      if (table === "passports") {
        return {
          select: () => ({
            in: (column: string, ids: string[]) => {
              if (column === "product_id") {
                return chain(
                  filterRows((passport) => ids.includes(String(passport.product_id))),
                )
              }
              return Promise.resolve({
                data: ids.map((id) => byId.get(id)).filter(Boolean),
                error: null,
              })
            },
            filter: (_column: string, _op: string, value: string) =>
              chain(filterRows((passport) => passport.metadata.qr_batch_job_id === value)),
            gte: (_column: string, since: string) =>
              chain(
                filterRows(
                  (passport) => new Date(passport.created_at).getTime() >= new Date(since).getTime(),
                ),
              ),
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }
      }

      if (table === "products") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [{ id: "product-1" }], error: null }),
            }),
          }),
        }
      }

      return {
        select: () => chain([]),
      }
    },
  }
}

describe("passport-batch-export-server", () => {
  it("creates one zip entry per passport inside a batch folder", async () => {
    MockZip.reset()
    const passports = batchTwoIds.map((id, index) => ({
      id,
      serial_number: `OP-BATCH2-${index}`,
    }))

    const { fileCount } = await buildPassportLabelsZip("batch-test", passports, {
      folderName: "Passport manifest Summer Collection A",
    })
    expect(fileCount).toBe(3)

    const zip = MockZip.lastInstance()
    expect(zip).not.toBeNull()
    const paths = Object.keys(zip!.files)
    expect(paths).toHaveLength(3)
    expect(paths.every((path) => path.startsWith("Passport manifest Summer Collection A/"))).toBe(true)
    expect(paths.every((path) => path.endsWith(".png"))).toBe(true)
  })

  it("resolvePassportIdsForJob returns second batch ids when metadata still references first batch", async () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchTwoIds,
      passport_ids: batchOneIds,
      manifest_batch_id: "BATCH-2026-04",
      labels_exported_at: "2026-05-20T01:05:00.000Z",
    }

    const admin = createMockAdmin([
      ...batchOneIds.map((id, index) =>
        row(id, jobOne.id, `2026-05-20T00:00:0${index + 1}.000Z`),
      ),
      ...batchTwoIds.map((id, index) =>
        row(id, jobTwo.id, `2026-05-20T01:00:0${index + 1}.000Z`),
      ),
    ])

    const resolved = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)

    expect(resolved).toEqual(batchTwoIds)
    expect(resolved).not.toEqual(batchOneIds)
  })

  it("resolvePassportIdsForJob ignores passports linked to the job but created in another batch window", async () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchTwoIds,
      passport_ids: batchTwoIds,
    }

    const admin = createMockAdmin([
      ...batchOneIds.map((id, index) =>
        row(id, jobTwo.id, `2026-05-20T00:00:0${index + 1}.000Z`),
      ),
      ...batchTwoIds.map((id, index) =>
        row(id, jobTwo.id, `2026-05-20T01:00:0${index + 1}.000Z`),
      ),
    ])

    const resolved = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
    expect(resolved).toEqual(batchTwoIds)
    expect(resolved).not.toEqual(batchOneIds)
  })

  it("resolvePassportIdsForJob prefers import_passport_ids when they belong to the requested job", async () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchTwoIds,
      passport_ids: batchTwoIds,
    }

    const admin = createMockAdmin(
      batchTwoIds.map((id, index) => row(id, jobTwo.id, `2026-05-20T01:00:0${index + 1}.000Z`)),
    )

    const resolved = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
    expect(resolved).toEqual(batchTwoIds)
    expect(jobLabelCount(jobTwo, metadata)).toBe(3)
  })
})
