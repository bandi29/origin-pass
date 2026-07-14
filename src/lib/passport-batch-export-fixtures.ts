import type { BatchJobForExport, BatchJobMetadata } from "@/lib/passport-batch-export-resolver"

export type FixturePassportRow = {
  id: string
  created_at: string
  product_id: string
  serial_number: string
  metadata: { qr_batch_job_id?: string | null; batch_id?: string | null }
}

export const SHARED_MANIFEST_BATCH_ID = "BATCH-2026-04"

export const jobOne: BatchJobForExport = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  job_name: "Passport manifest EUDR-DDS-837492",
  organization_id: "org-1",
  created_by: "user-1",
  started_at: "2026-05-20T00:00:00.000Z",
  completed_at: "2026-05-20T00:00:05.000Z",
  input_count: 3,
  success_count: 3,
}

export const jobTwo: BatchJobForExport = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  job_name: "Passport manifest Summer Collection A",
  organization_id: "org-1",
  created_by: "user-1",
  started_at: "2026-05-20T01:00:00.000Z",
  completed_at: "2026-05-20T01:00:05.000Z",
  input_count: 3,
  success_count: 3,
}

export const jobSixRow: BatchJobForExport = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  job_name: "Passport manifest Six Row Run",
  organization_id: "org-1",
  created_by: "user-1",
  started_at: "2026-05-20T02:00:00.000Z",
  completed_at: "2026-05-20T02:00:10.000Z",
  input_count: 6,
  success_count: 6,
}

export const batchOneIds = [
  "11111111-1111-1111-1111-111111111101",
  "11111111-1111-1111-1111-111111111102",
  "11111111-1111-1111-1111-111111111103",
]

export const batchTwoIds = [
  "22222222-2222-2222-2222-222222222201",
  "22222222-2222-2222-2222-222222222202",
  "22222222-2222-2222-2222-222222222203",
]

export const batchSixIds = [
  "33333333-3333-3333-3333-333333333301",
  "33333333-3333-3333-3333-333333333302",
  "33333333-3333-3333-3333-333333333303",
  "33333333-3333-3333-3333-333333333304",
  "33333333-3333-3333-3333-333333333305",
  "33333333-3333-3333-3333-333333333306",
]

export const batchOneSerials = ["OP-BE5BEF2A16C5", "OP-8E803C9E0DC8", "OP-023CE75F433E"]

export const batchTwoSerials = ["OP-SUMMER-001", "OP-SUMMER-002", "OP-SUMMER-003"]

export function fixturePassport(
  id: string,
  serial: string,
  jobId: string | null,
  createdAt: string,
  manifestBatchId = SHARED_MANIFEST_BATCH_ID,
): FixturePassportRow {
  return {
    id,
    serial_number: serial,
    created_at: createdAt,
    product_id: "product-1",
    metadata: {
      ...(jobId ? { qr_batch_job_id: jobId } : {}),
      batch_id: manifestBatchId,
    },
  }
}

export function buildBatchOnePassports(): FixturePassportRow[] {
  return batchOneIds.map((id, index) =>
    fixturePassport(
      id,
      batchOneSerials[index] ?? `OP-B1-${index}`,
      jobOne.id,
      `2026-05-20T00:00:0${index + 1}.000Z`,
    ),
  )
}

export function buildBatchTwoPassports(): FixturePassportRow[] {
  return batchTwoIds.map((id, index) =>
    fixturePassport(
      id,
      batchTwoSerials[index] ?? `OP-B2-${index}`,
      jobTwo.id,
      `2026-05-20T01:00:0${index + 1}.000Z`,
    ),
  )
}

export function buildBatchSixPassports(): FixturePassportRow[] {
  return batchSixIds.map((id, index) =>
    fixturePassport(
      id,
      `OP-SIX-${String(index + 1).padStart(3, "0")}`,
      jobSixRow.id,
      `2026-05-20T02:00:0${index + 1}.000Z`,
    ),
  )
}

export function metadataForJob(
  job: BatchJobForExport,
  passportIds: string[],
  extras: Partial<BatchJobMetadata> = {},
): BatchJobMetadata {
  return {
    source: "passport_manifest_import",
    manifest_batch_id: SHARED_MANIFEST_BATCH_ID,
    export_folder_name: job.job_name ?? undefined,
    import_passport_ids: passportIds,
    passport_ids: passportIds,
    ...extras,
  }
}

export function createExportMockAdmin(passports: FixturePassportRow[]) {
  const byId = new Map(passports.map((passport) => [passport.id, passport]))

  const filterRows = (predicate: (passport: FixturePassportRow) => boolean) =>
    passports.filter(predicate)

  const chain = (rows: FixturePassportRow[]) => {
    const api = {
      eq: () => api,
      in: (column: string, values: string[]) => {
        if (column === "product_id") {
          return chain(filterRows((passport) => values.includes(String(passport.product_id))))
        }
        return api
      },
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
      maybeSingle: () => Promise.resolve({ data: { organization_id: "org-1" }, error: null }),
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
            eq: (column: string, _value: string) => {
              if (column === "organization_id") {
                return Promise.resolve({ data: [{ id: "product-1" }], error: null })
              }
              return {
                eq: () => Promise.resolve({ data: [{ id: "product-1" }], error: null }),
              }
            },
          }),
        }
      }

      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { organization_id: "org-1" }, error: null }),
            }),
          }),
        }
      }

      if (table === "qr_batch_jobs") {
        return {
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        }
      }

      return {
        select: () => chain([]),
      }
    },
  }
}
