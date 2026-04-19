import { expect, test } from "@playwright/test"

const hasAuthCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD

async function login(page: import("@playwright/test").Page) {
  await page.goto("/en/login")
  await page.getByPlaceholder("you@brand.com").fill(process.env.E2E_EMAIL || "")
  await page.getByPlaceholder("Your password").fill(process.env.E2E_PASSWORD || "")
  await page.getByRole("button", { name: "Sign In" }).click()
  await page.waitForURL(/\/dashboard/)
}

test.describe("Batch step guidance", () => {
  test.skip(!hasAuthCreds, "Set E2E_EMAIL and E2E_PASSWORD to run authenticated dashboard E2E tests")

  test("shows clear checklist when Next is disabled", async ({ page }) => {
    await login(page)
    await page.goto("/en/dashboard/batches")
    await expect(page.getByText("Complete these to continue:")).toBeVisible()
    await expect(page.getByText("Select a product")).toBeVisible()
  })
})

