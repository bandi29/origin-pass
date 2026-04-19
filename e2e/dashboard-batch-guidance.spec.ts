import { expect, test } from "@playwright/test"

const hasAuthCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD

async function login(page: import("@playwright/test").Page) {
  await page.goto("/en/login")
  await page.getByPlaceholder("you@company.com").fill(process.env.E2E_EMAIL || "")
  await page.getByPlaceholder("••••••••").fill(process.env.E2E_PASSWORD || "")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/dashboard/)
}

test.describe("Batch step guidance", () => {
  test.skip(!hasAuthCreds, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated dashboard E2E tests")

  test("shows warning when no products exist yet", async ({ page }) => {
    await login(page)
    await page.goto("/en/dashboard/batches")
    // If no products: amber notice is shown
    const noProductsNotice = page.getByText(/Add at least one product/i)
    const batchForm = page.getByText(/Create New Batch/i)
    // One of these should be visible depending on account state
    await expect(noProductsNotice.or(batchForm)).toBeVisible()
  })

  test("shows blocking checklist when Next is disabled in BatchForm", async ({ page }) => {
    await login(page)
    await page.goto("/en/dashboard/batches")
    // If products exist, the BatchForm renders with step guidance
    const createBatchHeading = page.getByText("Create New Batch")
    if (await createBatchHeading.isVisible()) {
      await expect(page.getByText("Complete these to continue:")).toBeVisible()
      await expect(page.getByText("Select a product")).toBeVisible()
    }
  })

  test("batches page title and description render correctly", async ({ page }) => {
    await login(page)
    await page.goto("/en/dashboard/batches")
    await expect(page.getByRole("heading", { name: "Batches" })).toBeVisible()
    await expect(page.getByText(/digital product passports/i)).toBeVisible()
  })
})


