import { expect, test } from "@playwright/test"

const hasAuthCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD

async function login(page: import("@playwright/test").Page) {
  await page.goto("/en/login")
  await page.getByPlaceholder("you@brand.com").fill(process.env.E2E_EMAIL || "")
  await page.getByPlaceholder("Your password").fill(process.env.E2E_PASSWORD || "")
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL(/\/dashboard/)
}

function draftPayload(overrides?: Record<string, unknown>) {
  return {
    productName: "Draft Leather Bag",
    story: "Saved draft story",
    selectedMaterials: ["Leather"],
    materialsOther: "",
    originCountry: "Italy",
    originCity: "Florence",
    originOther: "",
    repairable: "Yes",
    lifespan: "5-10",
    recyclable: "No",
    imageUrl: "",
    ts: Date.now(),
    ...overrides,
  }
}

test.describe("Dashboard draft flow", () => {
  test.skip(!hasAuthCreds, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated dashboard E2E tests")

  test("Save Draft persists and can be resumed after reload", async ({ page }) => {
    await login(page)
    await page.goto("/en/dashboard/products")

    await page.getByPlaceholder("Handcrafted Leather Satchel").fill("Flow Draft Product")
    await page.getByRole("button", { name: /^Save Draft$/ }).click()
    await expect(page.getByText(/Draft saved/i)).toBeVisible()

    await page.reload()
    await expect(page.getByText(/You have a saved draft/i)).toBeVisible()
    await expect(page.getByText(/Saved .* ago|Saved just now|Saved recently/)).toBeVisible()

    await page.getByRole("button", { name: /Resume draft/i }).click()
    await expect(page.getByDisplayValue("Flow Draft Product")).toBeVisible()
  })

  test("User can delete pending draft", async ({ page }) => {
    await login(page)
    await page.goto("/en/dashboard/products")

    await page.evaluate((payload) => {
      localStorage.setItem("originpass-product-form-draft", JSON.stringify(payload))
    }, draftPayload({ ts: Date.now() - 2 * 60 * 60 * 1000 }))

    await page.reload()
    await expect(page.getByText(/You have a saved draft/i)).toBeVisible()
    await page.getByRole("button", { name: /Delete draft/i }).click()
    await expect(page.getByText(/Saved draft removed/i)).toBeVisible()
    await expect(page.getByText(/You have a saved draft/i)).not.toBeVisible()
  })
})

