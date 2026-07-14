import { describe, expect, it, vi } from "vitest"
import {
  applyLayoutSnapshot,
  buildLayoutSnapshot,
  normalizeLayoutSnapshot,
  uniquifyTemplateName,
  suggestSaveTemplateName,
  type LayoutSnapshotSource,
} from "@/lib/labels/layout-template-snapshot"

const baseSource: LayoutSnapshotSource = {
  previewMode: "sheet",
  layoutUnit: "mm",
  marginTop: 12,
  marginRight: 10,
  marginBottom: 8,
  marginLeft: 10,
  marginsLinked: false,
  cellWidthMm: 50,
  cellHeightMm: 90,
  dimensionsLinked: true,
  aspectRatio: 50 / 90,
  labelGapPx: 6,
  quantity: 2,
  paperSize: "a4",
  bleedMm: 2,
  dpi: 300,
  alignment: "center",
  showCropMarks: true,
  snapToGrid: false,
  doubleSided: false,
  labelFace: "front",
  cols: 3,
  rows: 4,
  exportFormat: "pdf",
  branding: {
    qrStyle: "luxury",
    brandColor: "#356B4E",
    borderStyle: "premium",
    typographyStyle: "serif",
    footerText: "Verified",
    showLogo: true,
    showQrCode: false,
    showProductName: true,
    qrSizeInches: 0.8,
    labelTextPt: 12,
  },
  logoDataUrl: "data:image/jpeg;base64,abc",
  baseSystemTemplateId: "system-1",
}

describe("buildLayoutSnapshot", () => {
  it("captures full layout and branding state", () => {
    const snap = buildLayoutSnapshot(baseSource)
    expect(snap.previewMode).toBe("sheet")
    expect(snap.marginTop).toBe(12)
    expect(snap.branding.showQrCode).toBe(false)
    expect(snap.logoDataUrl).toBe("data:image/jpeg;base64,abc")
    expect(snap.exportFormat).toBe("pdf")
    expect(snap.cols).toBe(3)
    expect(snap.rows).toBe(4)
  })
})

describe("normalizeLayoutSnapshot", () => {
  it("fills defaults for partial legacy payloads", () => {
    const normalized = normalizeLayoutSnapshot({ cellWidthMm: 40 })
    expect(normalized.cellWidthMm).toBe(40)
    expect(normalized.previewMode).toBe("single")
    expect(normalized.branding.showLogo).toBe(true)
  })
})

describe("applyLayoutSnapshot", () => {
  it("restores snapshot fields into studio state", () => {
    const snap = buildLayoutSnapshot(baseSource)
    const target = {
      setPreviewMode: vi.fn(),
      setLayoutUnit: vi.fn(),
      setMarginTop: vi.fn(),
      setMarginRight: vi.fn(),
      setMarginBottom: vi.fn(),
      setMarginLeft: vi.fn(),
      setMarginsLinked: vi.fn(),
      setCellWidthMm: vi.fn(),
      setCellHeightMm: vi.fn(),
      setDimensionsLinked: vi.fn(),
      aspectRatioRef: { current: 1 },
      setLabelGapPx: vi.fn(),
      setQuantity: vi.fn(),
      setPaperSize: vi.fn(),
      setBleedMm: vi.fn(),
      setDpi: vi.fn(),
      setAlignment: vi.fn(),
      setShowCropMarks: vi.fn(),
      setSnapToGrid: vi.fn(),
      setLabelFace: vi.fn(),
      setBranding: vi.fn(),
      setLogoDataUrl: vi.fn(),
      onExportFormatChange: vi.fn(),
    }

    applyLayoutSnapshot(target, snap)

    expect(target.setPreviewMode).toHaveBeenCalledWith("sheet")
    expect(target.setMarginTop).toHaveBeenCalledWith(12)
    expect(target.setBranding).toHaveBeenCalledWith(snap.branding)
    expect(target.setLogoDataUrl).toHaveBeenCalledWith("data:image/jpeg;base64,abc")
    expect(target.onExportFormatChange).toHaveBeenCalledWith("pdf")
    expect(target.aspectRatioRef.current).toBeCloseTo(50 / 90)
  })
})

describe("uniquifyTemplateName", () => {
  it("appends (copy) and increments for collisions", () => {
    const existing = ["Luxury Hang Tag", "Luxury Hang Tag (copy)"]
    expect(uniquifyTemplateName("Luxury Hang Tag", existing)).toBe("Luxury Hang Tag (copy 2)")
    expect(uniquifyTemplateName("Plain", [])).toBe("Plain (copy)")
  })

  it("is case-insensitive against existing names", () => {
    expect(uniquifyTemplateName("luxury hang tag", ["Luxury Hang Tag"])).toBe("luxury hang tag (copy)")
  })
})

describe("suggestSaveTemplateName", () => {
  it("suggests a distinct custom name from the current template", () => {
    expect(suggestSaveTemplateName("Avery 5160")).toBe("Avery 5160 (custom)")
    expect(suggestSaveTemplateName(undefined)).toBe("Custom layout (custom)")
  })
})
