"use client"

import { useCallback, useEffect, useState } from "react"
import type { PersistedVisualTemplate } from "@/lib/labels/layout-template-types"
import {
  createLayoutTemplate,
  deleteLayoutTemplate,
  fetchLayoutTemplates,
  LayoutTemplateApiError,
  updateLayoutTemplate,
} from "@/lib/labels/layout-templates-client"
import { rowToPersistedVisualTemplate } from "@/lib/labels/layout-template-snapshot"
import type { CreateLayoutTemplateInput, UpdateLayoutTemplateInput } from "@/lib/labels/layout-template-types"

export function useLabelStudioLayoutTemplates() {
  const [customTemplates, setCustomTemplates] = useState<PersistedVisualTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchLayoutTemplates()
      setCustomTemplates(rows.map(rowToPersistedVisualTemplate))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved templates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createTemplate = useCallback(
    async (input: CreateLayoutTemplateInput): Promise<PersistedVisualTemplate> => {
      const row = await createLayoutTemplate(input)
      const mapped = rowToPersistedVisualTemplate(row)
      setError(null)
      setCustomTemplates((prev) => [mapped, ...prev.filter((t) => t.id !== mapped.id)])
      return mapped
    },
    [],
  )

  const patchTemplate = useCallback(
    async (id: string, input: UpdateLayoutTemplateInput): Promise<PersistedVisualTemplate> => {
      const row = await updateLayoutTemplate(id, input)
      const mapped = rowToPersistedVisualTemplate(row)
      setError(null)
      setCustomTemplates((prev) => [mapped, ...prev.filter((t) => t.id !== mapped.id)])
      return mapped
    },
    [],
  )

  const removeTemplate = useCallback(async (id: string) => {
    await deleteLayoutTemplate(id)
    setError(null)
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const templateNames = customTemplates.map((t) => t.name)

  const upsertLocal = useCallback((template: PersistedVisualTemplate) => {
    setCustomTemplates((prev) => [template, ...prev.filter((t) => t.id !== template.id)])
  }, [])

  const removeLocal = useCallback((id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return {
    customTemplates,
    loading,
    error,
    refetch,
    createTemplate,
    patchTemplate,
    removeTemplate,
    upsertLocal,
    removeLocal,
    templateNames,
    isApiError: (e: unknown) => e instanceof LayoutTemplateApiError,
  }
}

export type LabelStudioLayoutTemplatesApi = ReturnType<typeof useLabelStudioLayoutTemplates>
