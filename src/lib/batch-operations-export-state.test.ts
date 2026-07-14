import { describe, expect, it } from "vitest"
import {
  batchExportActionLabel,
  jobHasBeenDownloaded,
  jobHasGeneratedAssets,
  mergeExportedBatchIds,
} from "@/lib/batch-operations-export-state"

describe("batch-operations-export-state", () => {
  it("treats completed jobs with records as asset-ready", () => {
    expect(
      jobHasGeneratedAssets({
        id: "a",
        status: "completed",
        recordCount: 12,
        successCount: 12,
      }),
    ).toBe(true)
    expect(
      jobHasGeneratedAssets({
        id: "b",
        status: "queued",
        recordCount: 12,
      }),
    ).toBe(false)
  })

  it("merges server export flags with persisted client ids", () => {
    const merged = mergeExportedBatchIds(new Set(["local-1"]), [
      { id: "server-1", status: "completed", recordCount: 1, hasBeenExported: true },
    ])
    expect(merged.has("local-1")).toBe(true)
    expect(merged.has("server-1")).toBe(true)
  })

  it("tracks downloaded state from either source", () => {
    expect(
      jobHasBeenDownloaded(
        { id: "x", status: "completed", recordCount: 1, hasBeenExported: true },
        new Set(),
      ),
    ).toBe(true)
    expect(
      jobHasBeenDownloaded(
        { id: "y", status: "completed", recordCount: 1 },
        new Set(["y"]),
      ),
    ).toBe(true)
  })

  it("switches export action labels after download", () => {
    expect(batchExportActionLabel(false, false)).toBe("Export ZIP")
    expect(batchExportActionLabel(true, false)).toBe("Re-export ZIP")
    expect(batchExportActionLabel(true, true)).toBe("Generating & Zipping...")
  })
})
