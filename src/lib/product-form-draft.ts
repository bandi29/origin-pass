/**
 * Persistent draft storage for ProductForm.
 * Uses localStorage so users can resume after logout/browser restart.
 * Falls back to sessionStorage if localStorage is unavailable.
 */

export const DRAFT_KEY = "originpass-product-form-draft"
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface ProductFormDraft {
  productName: string
  story: string
  selectedMaterials: string[]
  materialsOther: string
  originCountry: string
  originState: string
  originCity: string
  originOther: string
  repairable: string
  lifespan: string
  recyclable: string
  imageUrl: string
  savedAt?: number
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    if (window.localStorage) return window.localStorage
  } catch {
    // fall through
  }
  try {
    if (window.sessionStorage) return window.sessionStorage
  } catch {
    // fall through
  }
  return null
}

export function loadDraft(): ProductFormDraft | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown> & { ts?: number }
    if (!parsed || typeof parsed.ts !== "number") return null
    if (Date.now() - parsed.ts > MAX_AGE_MS) return null
    return {
      productName: typeof parsed.productName === "string" ? parsed.productName : "",
      story: typeof parsed.story === "string" ? parsed.story : "",
      selectedMaterials: Array.isArray(parsed.selectedMaterials) ? parsed.selectedMaterials : [],
      materialsOther: typeof parsed.materialsOther === "string" ? parsed.materialsOther : "",
      originCountry: typeof parsed.originCountry === "string" ? parsed.originCountry : "",
      originState: typeof parsed.originState === "string" ? parsed.originState : "",
      originCity: typeof parsed.originCity === "string" ? parsed.originCity : "",
      originOther: typeof parsed.originOther === "string" ? parsed.originOther : "",
      repairable: typeof parsed.repairable === "string" ? parsed.repairable : "",
      lifespan: typeof parsed.lifespan === "string" ? parsed.lifespan : "",
      recyclable: typeof parsed.recyclable === "string" ? parsed.recyclable : "",
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : "",
      savedAt: parsed.ts,
    }
  } catch {
    return null
  }
}

export function saveDraft(state: ProductFormDraft): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify({ ...state, ts: Date.now() }))
  } catch {
    /* ignore */
  }
}

export function clearDraft(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}
