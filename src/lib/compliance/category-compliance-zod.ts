import { z } from "zod"
import type { CategoryKey } from "./category-schemas"
import type { ComplianceData } from "./category-compliance-strategy"
import { getComplianceFieldErrors } from "./validate-category-product"

const complianceObjectIssue = {
  code: z.ZodIssueCode.custom,
  message: "compliance_data must be an object",
} as const

/**
 * Zod wrapper around registry-driven validation ({@link getComplianceFieldErrors}).
 * Use for API parsing or when you want structured Zod errors per category (LEATHER, TEXTILE, …).
 */
export function complianceDataSchemaForCategory(key: CategoryKey) {
  return z.unknown().superRefine((data, ctx) => {
    if (data === null || typeof data !== "object") {
      ctx.addIssue(complianceObjectIssue)
      return
    }
    for (const msg of getComplianceFieldErrors(key, data as ComplianceData)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg })
    }
  })
}

export function safeParseComplianceData(
  key: CategoryKey,
  data: unknown,
): { success: true; data: ComplianceData } | { success: false; error: z.ZodError } {
  const result = complianceDataSchemaForCategory(key).safeParse(data)
  if (result.success) {
    return { success: true, data: result.data as ComplianceData }
  }
  return { success: false, error: result.error }
}
