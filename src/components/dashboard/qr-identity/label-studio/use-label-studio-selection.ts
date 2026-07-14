"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { normalizeFilterProductId } from "@/lib/product-display-label"

export function useLabelStudioSelection(products: ProductPrintCandidate[]) {
  const searchParams = useSearchParams()
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [activeOnly, setActiveOnly] = useState(false)
  const [batchOnly, setBatchOnly] = useState(false)

  const filteredCatalog = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    return products.filter((p) => {
      if (verifiedOnly && p.verificationStatus.toLowerCase() !== "verified") return false
      if (activeOnly && p.qrStatus.toLowerCase() !== "active") return false
      if (batchOnly && !p.batchId) return false
      if (q) {
        const blob = `${p.name ?? ""} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [products, productSearch, verifiedOnly, activeOnly, batchOnly])

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds],
  )

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    )
  }, [])

  const removeProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => prev.filter((v) => v !== id))
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedProductIds.includes(id),
    [selectedProductIds],
  )

  useEffect(() => {
    const batchId = searchParams.get("batchId")?.trim()
    if (!batchId) return
    const inPayload = products.some((p) => p.batchId === batchId)
    if (!inPayload) return
    setBatchOnly(true)
    const ids = products.filter((p) => p.batchId === batchId).map((p) => p.id)
    if (ids.length) setSelectedProductIds(ids)
  }, [searchParams, products])

  useEffect(() => {
    const productId = normalizeFilterProductId(searchParams.get("productId"))
    if (!productId) return
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setSelectedProductIds([productId])
  }, [searchParams, products])

  useEffect(() => {
    const q =
      searchParams.get("printSearch")?.trim() ??
      searchParams.get("q")?.trim()
    if (!q) return
    setProductSearch(q)
  }, [searchParams])

  return {
    selectedProductIds,
    selectedProducts,
    filteredCatalog,
    productSearch,
    setProductSearch,
    verifiedOnly,
    setVerifiedOnly,
    activeOnly,
    setActiveOnly,
    batchOnly,
    setBatchOnly,
    toggleProduct,
    removeProduct,
    isSelected,
  }
}
