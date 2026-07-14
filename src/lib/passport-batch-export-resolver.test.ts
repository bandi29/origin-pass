import { describe, expect, it } from "vitest"
import {
  buildBatchExportFolderName,
  dedupePreserveOrder,
  filterJobLinkedPassportRows,
  filterPassportRowsForJobExport,
  getCanonicalImportPassportIds,
  isPassportLinkedToOtherJob,
  jobDiscoveryQueryLimit,
  jobLabelCount,
  passportBelongsToJob,
  passportCreatedDuringJob,
  pickPassportIdsForJob,
} from "@/lib/passport-batch-export-resolver"
import type { BatchJobForExport, BatchJobMetadata } from "@/lib/passport-batch-export-resolver"

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

describe("passport-batch-export-resolver", () => {
  it("dedupes ids while preserving first-seen order", () => {
    expect(dedupePreserveOrder(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"])
  })

  it("matches passports by qr_batch_job_id link", () => {
    expect(
      passportBelongsToJob(jobTwo, {
        id: batchTwoIds[0],
        created_at: "2026-05-20T01:00:02.000Z",
        metadata: { qr_batch_job_id: jobTwo.id },
      }),
    ).toBe(true)

    expect(
      passportBelongsToJob(jobTwo, {
        id: batchOneIds[0],
        created_at: "2026-05-20T01:00:02.000Z",
        metadata: { qr_batch_job_id: jobOne.id },
      }),
    ).toBe(false)
  })

  it("matches legacy passports only inside the job time window", () => {
    expect(
      passportBelongsToJob(jobTwo, {
        id: batchTwoIds[0],
        created_at: "2026-05-20T01:00:02.000Z",
        metadata: {},
      }),
    ).toBe(true)

    expect(
      passportBelongsToJob(jobTwo, {
        id: batchOneIds[0],
        created_at: "2026-05-20T00:00:02.000Z",
        metadata: {},
      }),
    ).toBe(false)
  })

  it("returns second batch ids even when metadata still references first batch ids", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchOneIds,
      passport_ids: batchOneIds,
      manifest_batch_id: "BATCH-2026-04",
      labels_exported_at: "2026-05-20T01:05:00.000Z",
    }

    const verified = batchTwoIds
    const picked = pickPassportIdsForJob({
      job: jobTwo,
      targetCount: jobLabelCount(jobTwo, metadata),
      byJobLink: batchTwoIds,
      canonicalImportIds: getCanonicalImportPassportIds(metadata, jobTwo),
      verifiedCanonicalIds: verified,
      byJobWindow: batchTwoIds,
    })

    expect(picked).toEqual(batchTwoIds)
    expect(picked).not.toEqual(batchOneIds)
  })

  it("prefers qr_batch_job_id results over stale canonical metadata", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchOneIds,
      passport_ids: batchOneIds,
    }

    const picked = pickPassportIdsForJob({
      job: jobTwo,
      targetCount: 3,
      byJobLink: batchTwoIds,
      canonicalImportIds: batchOneIds,
      verifiedCanonicalIds: [],
      byJobWindow: [],
    })

    expect(picked).toEqual(batchTwoIds)
  })

  it("uses verified canonical ids for the active job when no qr link exists yet", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchTwoIds,
      passport_ids: batchTwoIds,
    }

    const picked = pickPassportIdsForJob({
      job: jobTwo,
      targetCount: jobLabelCount(jobTwo, metadata),
      byJobLink: [],
      canonicalImportIds: batchTwoIds,
      verifiedCanonicalIds: batchTwoIds,
      byJobWindow: [],
    })

    expect(picked).toEqual(batchTwoIds)
  })

  it("uses job discovery limits from success_count rather than stale shorter metadata", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchOneIds,
      passport_ids: batchOneIds,
    }

    expect(jobDiscoveryQueryLimit(jobTwo)).toBe(3)
    expect(jobLabelCount(jobTwo, metadata)).toBe(3)
    expect(getCanonicalImportPassportIds(metadata, jobTwo)).toEqual(batchOneIds)
  })

  it("builds a stable export folder name from job metadata or job name", () => {
    expect(
      buildBatchExportFolderName(
        { id: jobTwo.id, job_name: "Passport manifest Summer Collection A" },
        { export_folder_name: "Summer Collection A" },
      ),
    ).toBe("Summer Collection A")

    expect(
      buildBatchExportFolderName({ id: jobTwo.id, job_name: "Passport manifest Summer Collection A" }),
    ).toBe("Passport manifest Summer Collection A")

    expect(buildBatchExportFolderName({ id: jobTwo.id, job_name: null })).toBe(
      `batch-${jobTwo.id.slice(0, 8)}`,
    )
  })

  it("filterJobLinkedPassportRows rejects passports linked to the job but created in another batch window", () => {
    const stolen = batchOneIds.map((id, index) => ({
      id,
      created_at: `2026-05-20T00:00:0${index + 1}.000Z`,
      metadata: { qr_batch_job_id: jobTwo.id },
    }))

    expect(filterJobLinkedPassportRows(jobTwo, stolen)).toEqual([])
  })

  it("filterJobLinkedPassportRows keeps passports linked to the job and created during its window", () => {
    const rows = batchTwoIds.map((id, index) => ({
      id,
      created_at: `2026-05-20T01:00:0${index + 1}.000Z`,
      metadata: { qr_batch_job_id: jobTwo.id },
    }))

    expect(filterJobLinkedPassportRows(jobTwo, rows).map((row) => row.id)).toEqual(batchTwoIds)
  })

  it("filters export rows to the job import list and rejects foreign links", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchTwoIds,
    }

    const rows = [
      {
        id: batchOneIds[0],
        created_at: "2026-05-20T00:00:01.000Z",
        metadata: { qr_batch_job_id: jobTwo.id },
      },
      ...batchTwoIds.map((id, index) => ({
        id,
        created_at: `2026-05-20T01:00:0${index + 1}.000Z`,
        metadata: { qr_batch_job_id: jobTwo.id },
      })),
    ]

    const filtered = filterPassportRowsForJobExport(jobTwo, rows, metadata)
    expect(filtered.map((row) => row.id)).toEqual(batchTwoIds)
    expect(isPassportLinkedToOtherJob(jobTwo, rows[0])).toBe(false)
  })

  it("rejects import list ids created outside the job window", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchOneIds,
    }

    const rows = batchOneIds.map((id, index) => ({
      id,
      created_at: `2026-05-20T00:00:0${index + 1}.000Z`,
      metadata: { qr_batch_job_id: jobTwo.id },
    }))

    expect(filterPassportRowsForJobExport(jobTwo, rows, metadata)).toEqual([])
    expect(passportCreatedDuringJob(jobTwo, rows[0])).toBe(false)
  })

  it("accepts import list ids created inside the job window even before qr link exists", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchTwoIds,
    }

    const rows = batchTwoIds.map((id, index) => ({
      id,
      created_at: `2026-05-20T01:00:0${index + 1}.000Z`,
      metadata: {},
    }))

    expect(filterPassportRowsForJobExport(jobTwo, rows, metadata).map((row) => row.id)).toEqual(
      batchTwoIds,
    )
  })

  it("can relax import list enforcement to recover from stale metadata", () => {
    const metadata: BatchJobMetadata = {
      import_passport_ids: batchOneIds,
    }

    const rows = batchTwoIds.map((id, index) => ({
      id,
      created_at: `2026-05-20T01:00:0${index + 1}.000Z`,
      metadata: { qr_batch_job_id: jobTwo.id },
    }))

    expect(
      filterPassportRowsForJobExport(jobTwo, rows, metadata, { enforceImportList: true }),
    ).toEqual([])
    expect(
      filterPassportRowsForJobExport(jobTwo, rows, metadata, { enforceImportList: false }).map(
        (row) => row.id,
      ),
    ).toEqual(batchTwoIds)
  })
})
