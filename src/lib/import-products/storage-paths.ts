import { mkdir } from "node:fs/promises"
import path from "node:path"

export const IMPORT_STORAGE_SUBDIR = ".data/import-uploads"

export function getImportStorageRoot(): string {
  return path.join(process.cwd(), IMPORT_STORAGE_SUBDIR)
}

export function getImportFileAbsolutePath(userId: string, jobId: string, fileName: string): string {
  const ext = path.extname(fileName).toLowerCase() || ".csv"
  const safe = ext === ".xlsx" || ext === ".csv" ? ext : ".csv"
  return path.join(getImportStorageRoot(), userId, `${jobId}${safe}`)
}

export async function ensureImportDir(userId: string): Promise<string> {
  const dir = path.join(getImportStorageRoot(), userId)
  await mkdir(dir, { recursive: true })
  return dir
}
