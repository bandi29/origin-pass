import { randomBytes } from "node:crypto"

export function generateImportQrRef(): string {
  return `OP-${randomBytes(5).toString("hex")}`
}
