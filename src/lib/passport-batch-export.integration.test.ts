import { describe, expect, it, vi } from "vitest"
import { jobLabelCount } from "@/lib/passport-batch-export-resolver"
import {
  batchOneIds,
  batchOneSerials,
  batchSixIds,
  batchTwoIds,
  batchTwoSerials,
  buildBatchOnePassports,
  buildBatchSixPassports,
  buildBatchTwoPassports,
  createExportMockAdmin,
  jobOne,
  jobSixRow,
  jobTwo,
  metadataForJob,
  SHARED_MANIFEST_BATCH_ID,
} from "@/lib/passport-batch-export-fixtures"

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
import {
  assertBatchJobExportAccess,
  buildPassportLabelsZip,
  loadPassportsForExport,
  resolvePassportIdsForJob,
} from "@/lib/passport-batch-export-server"

const MockZip = JSZip as unknown as {
  lastInstance(): { files: Record<string, Buffer> } | null
  reset(): void
}

const allPassports = [
  ...buildBatchOnePassports(),
  ...buildBatchTwoPassports(),
  ...buildBatchSixPassports(),
]

function adminWithAllBatches() {
  return createExportMockAdmin(allPassports)
}

async function resolveAndZip(
  job: typeof jobOne,
  metadata: ReturnType<typeof metadataForJob>,
  batchId: string,
) {
  const admin = adminWithAllBatches()
  const passportIds = await resolvePassportIdsForJob(admin as never, job, metadata)
  const passportRows = passportIds.map((id) => {
    const row = allPassports.find((passport) => passport.id === id)
    return { id, serial_number: row?.serial_number ?? null }
  })
  const passports = await loadPassportsForExport(admin as never, passportIds)
  const serials = (passports ?? []).map((passport) => passport.serial_number)
  const { fileCount } = await buildPassportLabelsZip(batchId, passportRows, {
    folderName: job.job_name ?? undefined,
  })
  return { passportIds, serials, fileCount }
}

describe("passport batch export integration", () => {
  describe("batch isolation (regression: always downloading first row)", () => {
    it("exports batch 1 with batch 1 passport ids and serial numbers", async () => {
      const metadata = metadataForJob(jobOne, batchOneIds)
      const admin = adminWithAllBatches()

      const ids = await resolvePassportIdsForJob(admin as never, jobOne, metadata)
      expect(ids).toEqual(batchOneIds)
      expect(ids).not.toEqual(batchTwoIds)
    })

    it("exports batch 2 with batch 2 passport ids and serial numbers", async () => {
      const metadata = metadataForJob(jobTwo, batchTwoIds)
      const admin = adminWithAllBatches()

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
      expect(ids).toEqual(batchTwoIds)
      expect(ids).not.toEqual(batchOneIds)
    })

    it("batch 1 and batch 2 exports share zero passport ids", async () => {
      const admin = adminWithAllBatches()
      const batch1 = await resolvePassportIdsForJob(
        admin as never,
        jobOne,
        metadataForJob(jobOne, batchOneIds),
      )
      const batch2 = await resolvePassportIdsForJob(
        admin as never,
        jobTwo,
        metadataForJob(jobTwo, batchTwoIds),
      )

      const overlap = batch1.filter((id) => batch2.includes(id))
      expect(overlap).toEqual([])
    })

    it("batch 1 zip contains OP-BE5BEF serials, batch 2 zip contains OP-SUMMER serials", async () => {
      const batch1 = await resolveAndZip(jobOne, metadataForJob(jobOne, batchOneIds), jobOne.id)
      const batch2 = await resolveAndZip(jobTwo, metadataForJob(jobTwo, batchTwoIds), jobTwo.id)

      expect(batch1.serials).toEqual(batchOneSerials)
      expect(batch2.serials).toEqual(batchTwoSerials)
      expect(batch1.serials).not.toEqual(batch2.serials)
    })

    it("does not cross-contaminate when both jobs share manifest batch_id BATCH-2026-04", async () => {
      const admin = adminWithAllBatches()
      const corruptBatch2Meta = metadataForJob(jobTwo, batchOneIds, {
        passport_ids: batchOneIds,
        labels_exported_at: "2026-05-20T01:05:00.000Z",
      })

      const batch2Ids = await resolvePassportIdsForJob(admin as never, jobTwo, corruptBatch2Meta)
      expect(batch2Ids).toEqual(batchTwoIds)
      expect(batch2Ids).not.toEqual(batchOneIds)
    })
  })

  describe("label count matches job success_count (regression: always 3 labels toast)", () => {
    it("returns exactly 3 labels for a 3-row batch job", async () => {
      const metadata = metadataForJob(jobOne, batchOneIds)
      expect(jobLabelCount(jobOne, metadata)).toBe(3)

      const { passportIds, fileCount } = await resolveAndZip(jobOne, metadata, jobOne.id)
      expect(passportIds).toHaveLength(3)
      expect(fileCount).toBe(3)
    })

    it("returns exactly 6 labels for a 6-row batch job, not capped at 3", async () => {
      const metadata = metadataForJob(jobSixRow, batchSixIds)
      expect(jobLabelCount(jobSixRow, metadata)).toBe(6)

      const admin = createExportMockAdmin(buildBatchSixPassports())
      const ids = await resolvePassportIdsForJob(admin as never, jobSixRow, metadata)

      expect(ids).toHaveLength(6)
      expect(ids).toEqual(batchSixIds)
    })

    it("uses success_count over stale shorter import_passport_ids in label cap", () => {
      const metadata = metadataForJob(jobSixRow, batchOneIds)
      expect(jobLabelCount(jobSixRow, metadata)).toBe(6)
    })
  })

  describe("corrupt metadata and stolen job links", () => {
    it("rejects batch 1 ids listed on batch 2 when those passports were created in batch 1 window", async () => {
      const admin = createExportMockAdmin([...buildBatchOnePassports(), ...buildBatchTwoPassports()])
      const corruptMeta = metadataForJob(jobTwo, batchOneIds)

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, corruptMeta)
      expect(ids).toEqual(batchTwoIds)
    })

    it("rejects batch 1 passports stolen onto batch 2 job link but outside batch 2 import list", async () => {
      const stolenBatchOne = buildBatchOnePassports().map((passport) => ({
        ...passport,
        metadata: { ...passport.metadata, qr_batch_job_id: jobTwo.id },
      }))
      const admin = createExportMockAdmin([...stolenBatchOne, ...buildBatchTwoPassports()])
      const metadata = metadataForJob(jobTwo, batchTwoIds)

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
      expect(ids).toEqual(batchTwoIds)
      expect(ids.some((id) => batchOneIds.includes(id))).toBe(false)
    })

    it("rejects batch 1 passports stolen onto batch 2 link AND listed in corrupt import_passport_ids", async () => {
      const stolenBatchOne = buildBatchOnePassports().map((passport) => ({
        ...passport,
        metadata: { ...passport.metadata, qr_batch_job_id: jobTwo.id },
      }))
      const admin = createExportMockAdmin([...stolenBatchOne, ...buildBatchTwoPassports()])
      const corruptMeta = metadataForJob(jobTwo, batchOneIds)

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, corruptMeta)
      expect(ids).toEqual(batchTwoIds)
      expect(ids).not.toEqual(batchOneIds)
    })

    it("returns empty when job has no matching passports", async () => {
      const admin = createExportMockAdmin(buildBatchOnePassports())
      const metadata = metadataForJob(jobTwo, batchTwoIds)

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
      expect(ids).toEqual([])
    })
  })

  describe("legacy and window discovery", () => {
    it("discovers unlinked passports created during the job window", async () => {
      const unlinkedBatchTwo = buildBatchTwoPassports().map((passport) => ({
        ...passport,
        metadata: { batch_id: SHARED_MANIFEST_BATCH_ID },
      }))
      const admin = createExportMockAdmin(unlinkedBatchTwo)
      const metadata = metadataForJob(jobTwo, batchTwoIds)

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
      expect(ids).toEqual(batchTwoIds)
    })

    it("does not discover passports from another job time window via fallback", async () => {
      const admin = createExportMockAdmin(buildBatchOnePassports())
      const metadata: ReturnType<typeof metadataForJob> = {
        source: "passport_manifest_import",
        manifest_batch_id: SHARED_MANIFEST_BATCH_ID,
      }

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
      expect(ids).toEqual([])
    })
  })

  describe("zip structure", () => {
    it("writes each batch into its own named folder", async () => {
      MockZip.reset()
      const passports = buildBatchTwoPassports().map((passport) => ({
        id: passport.id,
        serial_number: passport.serial_number,
      }))

      await buildPassportLabelsZip(jobTwo.id, passports, {
        folderName: jobTwo.job_name ?? undefined,
      })

      const zip = MockZip.lastInstance()
      const paths = Object.keys(zip!.files)
      expect(paths.every((path) => path.startsWith(`${jobTwo.job_name}/`))).toBe(true)
      expect(paths).toHaveLength(3)
    })
  })

  describe("access control", () => {
    it("allows export when user created the batch job", async () => {
      const admin = adminWithAllBatches()
      const allowed = await assertBatchJobExportAccess(admin as never, "user-1", jobOne)
      expect(allowed).toBe(true)
    })

    it("denies export for unrelated user without org match", async () => {
      const admin = adminWithAllBatches()
      const allowed = await assertBatchJobExportAccess(admin as never, "other-user", {
        ...jobOne,
        created_by: "someone-else",
        organization_id: "other-org",
      })
      expect(allowed).toBe(false)
    })
  })

  describe("re-export for jobs already marked assets generated", () => {
    it("uses stored passport ids when assets_generated_at is set", async () => {
      const metadata = metadataForJob(jobTwo, batchTwoIds, {
        assets_generated_at: "2026-05-20T01:10:00.000Z",
        labels_exported_at: "2026-05-20T01:10:00.000Z",
      })
      const admin = adminWithAllBatches()

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
      expect(ids).toEqual(batchTwoIds)
    })

    it("re-export still rejects another batch ids stored on the wrong job", async () => {
      const metadata = metadataForJob(jobTwo, batchOneIds, {
        assets_generated_at: "2026-05-20T01:10:00.000Z",
        labels_exported_at: "2026-05-20T01:10:00.000Z",
      })
      const admin = adminWithAllBatches()

      const ids = await resolvePassportIdsForJob(admin as never, jobTwo, metadata)
      expect(ids).toEqual(batchTwoIds)
      expect(ids).not.toEqual(batchOneIds)
    })
  })

  describe("user-reported serial numbers never bleed across batches", () => {
    it("batch 2 export never contains OP-BE5BEF2A16C5 from batch 1", async () => {
      const admin = adminWithAllBatches()
      const ids = await resolvePassportIdsForJob(
        admin as never,
        jobTwo,
        metadataForJob(jobTwo, batchTwoIds),
      )

      const exported = allPassports.filter((passport) => ids.includes(passport.id))
      const serials = exported.map((passport) => passport.serial_number)
      expect(serials).not.toContain("OP-BE5BEF2A16C5")
      expect(serials).not.toContain("OP-8E803C9E0DC8")
      expect(serials).not.toContain("OP-023CE75F433E")
    })

    it("exporting batch 1 after batch 2 still returns batch 1 serials only", async () => {
      const admin = adminWithAllBatches()
      await resolvePassportIdsForJob(admin as never, jobTwo, metadataForJob(jobTwo, batchTwoIds))
      const batch1Ids = await resolvePassportIdsForJob(
        admin as never,
        jobOne,
        metadataForJob(jobOne, batchOneIds),
      )

      const serials = allPassports
        .filter((passport) => batch1Ids.includes(passport.id))
        .map((passport) => passport.serial_number)
      expect(serials).toEqual(batchOneSerials)
    })
  })
})

describe("passport batch export fixture sanity", () => {
  it("models two 3-row batches and one 6-row batch with distinct ids", () => {
    expect(batchOneIds).toHaveLength(3)
    expect(batchTwoIds).toHaveLength(3)
    expect(batchSixIds).toHaveLength(6)

    const allIds = [...batchOneIds, ...batchTwoIds, ...batchSixIds]
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it("uses the same manifest batch_id on fixture passports without sharing passport ids", () => {
    const batch1 = buildBatchOnePassports()
    const batch2 = buildBatchTwoPassports()
    expect(batch1.every((passport) => passport.metadata.batch_id === SHARED_MANIFEST_BATCH_ID)).toBe(
      true,
    )
    expect(batch2.every((passport) => passport.metadata.batch_id === SHARED_MANIFEST_BATCH_ID)).toBe(
      true,
    )
    expect(batch1[0].id).not.toBe(batch2[0].id)
  })
})
