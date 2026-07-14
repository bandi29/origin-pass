"use client"

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react"

export function isShopifySaveBarAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.shopify?.saveBar)
}

/**
 * Contextual save bar for embedded Shopify admin pages.
 *
 * When `useNative` is true and App Bridge is present, wires a `<form data-save-bar>`
 * bridge instead of rendering `<ui-save-bar>`. App Bridge custom elements break React
 * reconciliation and previously whitescreened the iframe; the form attribute lets
 * Shopify render the native bar without mounting ui-save-bar in our tree.
 */
export function useShopifyContextualSave(input: {
  id: string
  isDirty: boolean
  saving?: boolean
  saveLabel?: string
  discardLabel?: string
  onSave: () => void | Promise<void>
  onDiscard: () => void
  /** Opt in to native App Bridge save bar (product editor only for now). */
  useNative?: boolean
  /** Serialized editable state for data-save-bar dirty detection. */
  formFingerprint?: string
}): {
  nativeSaveBarActive: boolean
  saveBarFormProps?: {
    "data-save-bar": true
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
    onReset: (event: FormEvent<HTMLFormElement>) => void
  }
  hiddenInputRef: RefObject<HTMLInputElement | null>
} {
  const { onSave, onDiscard, useNative = false, formFingerprint = "", saving = false } = input

  const onSaveRef = useRef(onSave)
  const onDiscardRef = useRef(onDiscard)
  const savingRef = useRef(saving)
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const [nativeAvailable, setNativeAvailable] = useState(false)

  useEffect(() => {
    onSaveRef.current = onSave
    onDiscardRef.current = onDiscard
  }, [onSave, onDiscard])

  useEffect(() => {
    savingRef.current = saving
  }, [saving])

  useEffect(() => {
    setNativeAvailable(isShopifySaveBarAvailable())
  }, [])

  const nativeSaveBarActive = Boolean(useNative && nativeAvailable)

  useEffect(() => {
    if (!nativeSaveBarActive) return
    const el = hiddenInputRef.current
    if (!el) return
    el.value = formFingerprint
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, [formFingerprint, nativeSaveBarActive])

  const saveBarFormProps = nativeSaveBarActive
    ? {
        "data-save-bar": true as const,
        onSubmit: (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          if (savingRef.current) return
          void onSaveRef.current()
        },
        onReset: (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          onDiscardRef.current()
        },
      }
    : undefined

  return { nativeSaveBarActive, saveBarFormProps, hiddenInputRef }
}

/** @deprecated Use useShopifyContextualSave — kept for any stale imports. */
export function useShopifyNativeSaveBar(): boolean {
  return isShopifySaveBarAvailable()
}

/** @deprecated Use useShopifyContextualSave */
export function ShopifyContextualSaveBar(props: Parameters<typeof useShopifyContextualSave>[0]) {
  useShopifyContextualSave(props)
  return null
}
