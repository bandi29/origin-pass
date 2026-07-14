import type {
  CreateLayoutTemplateInput,
  LabelLayoutTemplateRow,
  UpdateLayoutTemplateInput,
} from "@/lib/labels/layout-template-types"
import { duplicateNameUserMessage } from "@/lib/labels/layout-template-validation"

export class LayoutTemplateApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function parseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (res.status === 409) return body.error ?? duplicateNameUserMessage()
  return body.error ?? `Request failed (${res.status})`
}

export async function fetchLayoutTemplates(): Promise<LabelLayoutTemplateRow[]> {
  const res = await fetch("/api/labels/layout-templates", {
    credentials: "same-origin",
  })
  if (res.status === 401) return []
  if (!res.ok) throw new LayoutTemplateApiError(await parseError(res), res.status)
  const data = (await res.json()) as { templates?: LabelLayoutTemplateRow[] }
  return data.templates ?? []
}

export async function createLayoutTemplate(
  input: CreateLayoutTemplateInput,
): Promise<LabelLayoutTemplateRow> {
  const res = await fetch("/api/labels/layout-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new LayoutTemplateApiError(await parseError(res), res.status)
  const data = (await res.json()) as { template: LabelLayoutTemplateRow }
  return data.template
}

export async function updateLayoutTemplate(
  id: string,
  input: UpdateLayoutTemplateInput,
): Promise<LabelLayoutTemplateRow> {
  const res = await fetch(`/api/labels/layout-templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new LayoutTemplateApiError(await parseError(res), res.status)
  const data = (await res.json()) as { template: LabelLayoutTemplateRow }
  return data.template
}

export async function deleteLayoutTemplate(id: string): Promise<void> {
  const res = await fetch(`/api/labels/layout-templates/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  })
  if (!res.ok) throw new LayoutTemplateApiError(await parseError(res), res.status)
}
