/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  isShopifySaveBarAvailable,
  useShopifyContextualSave,
} from "./ShopifyContextualSaveBar"
import { readFileSync } from "node:fs"
import path from "node:path"

describe("isShopifySaveBarAvailable", () => {
  afterEach(() => {
    delete globalThis.shopify
  })

  it("returns false when shopify global is absent", () => {
    expect(isShopifySaveBarAvailable()).toBe(false)
  })

  it("returns true when shopify.saveBar exists", () => {
    globalThis.shopify = {
      idToken: async () => "token",
      toast: { show: vi.fn() },
      saveBar: { show: vi.fn(async () => {}), hide: vi.fn(async () => {}) },
    }
    expect(isShopifySaveBarAvailable()).toBe(true)
  })
})

describe("useShopifyContextualSave", () => {
  afterEach(() => {
    delete globalThis.shopify
  })

  it("does not throw when shopify global is absent", () => {
    expect(globalThis.shopify).toBeUndefined()

    expect(() =>
      renderHook(() =>
        useShopifyContextualSave({
          id: "test-save-bar",
          isDirty: true,
          onSave: vi.fn(),
          onDiscard: vi.fn(),
        }),
      ),
    ).not.toThrow()
  })

  it("never mounts ui-save-bar (avoids App Bridge iframe white-screen)", () => {
    globalThis.shopify = {
      idToken: async () => "token",
      toast: { show: vi.fn() },
      saveBar: { show: vi.fn(async () => {}), hide: vi.fn(async () => {}) },
    }

    const { result } = renderHook(() =>
      useShopifyContextualSave({
        id: "test-save-bar",
        isDirty: true,
        useNative: true,
        formFingerprint: "dirty-state",
        onSave: vi.fn(),
        onDiscard: vi.fn(),
      }),
    )

    act(() => {})

    expect(document.getElementById("test-save-bar")).toBeNull()
    expect(document.querySelector("ui-save-bar")).toBeNull()
    expect(result.current.nativeSaveBarActive).toBe(true)
    expect(result.current.saveBarFormProps?.["data-save-bar"]).toBe(true)
  })

  it("keeps fallback mode when useNative is false", () => {
    globalThis.shopify = {
      idToken: async () => "token",
      toast: { show: vi.fn() },
      saveBar: { show: vi.fn(async () => {}), hide: vi.fn(async () => {}) },
    }

    const { result } = renderHook(() =>
      useShopifyContextualSave({
        id: "test-save-bar",
        isDirty: true,
        onSave: vi.fn(),
        onDiscard: vi.fn(),
      }),
    )

    act(() => {})

    expect(result.current.nativeSaveBarActive).toBe(false)
    expect(result.current.saveBarFormProps).toBeUndefined()
  })

  it("bridges formFingerprint to a hidden input via input events", () => {
    globalThis.shopify = {
      idToken: async () => "token",
      toast: { show: vi.fn() },
      saveBar: { show: vi.fn(async () => {}), hide: vi.fn(async () => {}) },
    }

    const input = document.createElement("input")
    input.type = "hidden"
    document.body.appendChild(input)

    const dispatchSpy = vi.spyOn(input, "dispatchEvent")

    const { result, rerender } = renderHook(
      ({ fingerprint }) =>
        useShopifyContextualSave({
          id: "bridge-save-bar",
          isDirty: true,
          useNative: true,
          formFingerprint: fingerprint,
          onSave: vi.fn(),
          onDiscard: vi.fn(),
        }),
      { initialProps: { fingerprint: "a" } },
    )

    result.current.hiddenInputRef.current = input

    act(() => {
      rerender({ fingerprint: "b" })
    })

    expect(input.value).toBe("b")
    expect(dispatchSpy).toHaveBeenCalled()
    expect(dispatchSpy.mock.calls.some(([event]) => event.type === "input")).toBe(true)

    input.remove()
  })

  it("routes save and discard through form handlers", () => {
    globalThis.shopify = {
      idToken: async () => "token",
      toast: { show: vi.fn() },
      saveBar: { show: vi.fn(async () => {}), hide: vi.fn(async () => {}) },
    }

    const onSave = vi.fn()
    const onDiscard = vi.fn()

    const { result } = renderHook(() =>
      useShopifyContextualSave({
        id: "handler-save-bar",
        isDirty: true,
        useNative: true,
        formFingerprint: "state",
        onSave,
        onDiscard,
      }),
    )

    act(() => {})

    const formProps = result.current.saveBarFormProps
    expect(formProps).toBeDefined()

    const submitEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
    formProps!.onSubmit(submitEvent)
    expect(submitEvent.preventDefault).toHaveBeenCalled()
    expect(onSave).toHaveBeenCalled()

    const resetEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>
    formProps!.onReset(resetEvent)
    expect(resetEvent.preventDefault).toHaveBeenCalled()
    expect(onDiscard).toHaveBeenCalled()
  })
})

describe("ProductPassportEditorPage source", () => {
  it("does not reference undefined identifiers in module source", () => {
    const filePath = path.join(
      process.cwd(),
      "src/app/(shopify-embedded)/api/shopify/products/[productId]/ProductPassportEditorPage.tsx",
    )
    const source = readFileSync(filePath, "utf8")

    expect(source).toContain("useShopifyContextualSave")
    expect(source).toContain("useNative: false")
    expect(source).not.toMatch(/\bundefinedVariable\b/)
    expect(source).not.toMatch(/\bnativeSaveBar\b(?!\s*Active)/)
    expect(source).not.toContain("<ui-save-bar")
  })
})
