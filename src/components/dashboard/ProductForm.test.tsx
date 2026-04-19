/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ProductForm from "./ProductForm"
import { uploadProductImageClient, validateFile } from "@/lib/upload-product-image-client"
import { createProduct } from "@/actions/create-product"

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/actions/create-product", () => ({
  createProduct: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({})),
}))

vi.mock("@/lib/upload-product-image-client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/upload-product-image-client")>()
  return {
    ...mod,
    uploadProductImageClient: vi.fn(),
    validateFile: vi.fn(() => null),
  }
})

const mockSaveDraft = vi.fn()
const mockLoadDraft = vi.fn()
const mockClearDraft = vi.fn()

vi.mock("@/lib/product-form-draft", () => ({
  loadDraft: (...args: unknown[]) => mockLoadDraft(...args),
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  clearDraft: (...args: unknown[]) => mockClearDraft(...args),
}))

describe("ProductForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ suggestions: [] }),
      }))
    )
    mockLoadDraft.mockReturnValue(null)
    vi.mocked(uploadProductImageClient).mockResolvedValue({
      success: true,
      url: "https://example.com/uploaded.jpg",
    })
  })

  it("renders product name input", () => {
    render(<ProductForm />)
    expect(screen.getByPlaceholderText(/Handcrafted Leather/i)).toBeInTheDocument()
  })

  it("saves draft with current form state when file is selected", async () => {
    const user = userEvent.setup()
    render(<ProductForm />)

    const nameInput = screen.getByPlaceholderText(/Handcrafted Leather/i)
    await user.type(nameInput, "Handcrafted Leather Satchel")

    const fileInput = document.querySelector('[data-testid="product-image-file"]')
    expect(fileInput).toBeInTheDocument()

    const file = new File(["x"], "test.png", { type: "image/png" })
    fireEvent.change(fileInput!, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalled()
    })

    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: "Handcrafted Leather Satchel",
      })
    )
  })

  it("shows pending draft actions and restores when resume is clicked", async () => {
    mockLoadDraft.mockReturnValue({
      productName: "Restored Product",
      story: "Restored story",
      selectedMaterials: [] as string[],
      materialsOther: "",
      originCountry: "",
      originState: "",
      originCity: "",
      originOther: "",
      repairable: "",
      lifespan: "",
      recyclable: "",
      imageUrl: "",
      savedAt: Date.now() - 2 * 60 * 60 * 1000,
    })

    const user = userEvent.setup()
    render(<ProductForm />)

    expect(mockLoadDraft).toHaveBeenCalled()
    expect(screen.getByText(/You have a saved draft/i)).toBeInTheDocument()
    expect(screen.getByText(/Saved \d+h ago|Saved \d+m ago|Saved recently/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Resume draft/i }))
    expect(screen.getByDisplayValue("Restored Product")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Restored story")).toBeInTheDocument()
  })

  it("deletes pending draft when delete action is clicked", async () => {
    const user = userEvent.setup()
    mockLoadDraft.mockReturnValue({
      productName: "Pending Product",
      story: "",
      selectedMaterials: [] as string[],
      materialsOther: "",
      originCountry: "",
      originState: "",
      originCity: "",
      originOther: "",
      repairable: "",
      lifespan: "",
      recyclable: "",
      imageUrl: "",
      savedAt: Date.now() - 5 * 60 * 1000,
    })
    render(<ProductForm />)
    await user.click(screen.getByRole("button", { name: /Delete draft/i }))
    expect(mockClearDraft).toHaveBeenCalled()
    expect(screen.getByText(/Saved draft removed/i)).toBeInTheDocument()
  })

  it("saves draft with image URL after successful upload", async () => {
    render(<ProductForm />)

    const fileInput = document.querySelector('[data-testid="product-image-file"]')
    const file = new File(["x"], "test.png", { type: "image/png" })
    fireEvent.change(fileInput!, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: "https://example.com/uploaded.jpg",
        })
      )
    })
  })

  it("shows validation error when file is rejected by validateFile", async () => {
    vi.mocked(validateFile).mockReturnValue("File must be under 10MB")
    render(<ProductForm />)

    const fileInput = document.querySelector('[data-testid="product-image-file"]')
    const file = new File(["x"], "huge.png", { type: "image/png" })
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 })
    fireEvent.change(fileInput!, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText("File must be under 10MB")).toBeInTheDocument()
    })
    expect(uploadProductImageClient).not.toHaveBeenCalled()
  })

  it("Save Draft button stores draft without submitting product", async () => {
    const user = userEvent.setup()
    render(<ProductForm />)
    await user.type(screen.getByPlaceholderText(/Handcrafted Leather/i), "Draft Product")
    await user.click(screen.getByRole("button", { name: /^Save Draft$/i }))
    expect(mockSaveDraft).toHaveBeenCalled()
    expect(vi.mocked(createProduct)).not.toHaveBeenCalled()
    expect(screen.getByText(/Draft saved/i)).toBeInTheDocument()
  })

  it("shows state/region options based on selected country", async () => {
    const user = userEvent.setup()
    render(<ProductForm />)

    await user.selectOptions(screen.getByRole("combobox", { name: /Country/i }), "India")

    const stateSelect = screen.getByRole("combobox", { name: /State \/ Region/i })
    expect(stateSelect.querySelectorAll("option").length).toBeGreaterThan(1)

    const firstStateOption = Array.from(stateSelect.querySelectorAll("option")).find((option) => option.value)
    expect(firstStateOption).toBeDefined()
    await user.selectOptions(stateSelect, firstStateOption!.value)
    expect(stateSelect).toHaveValue(firstStateOption!.value)
  })

  it("shows city autocomplete suggestions and allows selecting one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ suggestions: ["Florence", "Firenze"] }),
      }))
    )
    const user = userEvent.setup()
    render(<ProductForm />)

    await user.selectOptions(screen.getByRole("combobox", { name: /Country/i }), "Italy")
    await user.type(screen.getByLabelText(/City \/ Place/i), "Flo")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Florence" })).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Florence" }))
    expect(screen.getByLabelText(/City \/ Place/i)).toHaveValue("Florence")
  })

  it("does not clear draft after successful Create & Continue", async () => {
    const user = userEvent.setup()
    vi.mocked(createProduct).mockResolvedValue({ success: true, productId: "prod-1" })

    render(<ProductForm />)
    await user.type(screen.getByPlaceholderText(/Handcrafted Leather/i), "Draft Keep Product")
    await user.click(screen.getByRole("button", { name: /Create & Continue/i }))

    await waitFor(() => {
      expect(vi.mocked(createProduct)).toHaveBeenCalled()
    })
    expect(mockClearDraft).not.toHaveBeenCalled()
  })
})
