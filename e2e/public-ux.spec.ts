import { expect, test } from "@playwright/test"

test.describe("Public UX basics", () => {
  test("login page shows required field guidance", async ({ page }) => {
    await page.goto("/en/login")
    await expect(page.getByText("* Required fields")).toBeVisible()
    await expect(page.getByText("Email address *")).toBeVisible()
  })

  test("support page shows required markers and clear CTA", async ({ page }) => {
    await page.goto("/en/support")
    await expect(page.getByText("* Required fields")).toBeVisible()
    await expect(page.getByRole("link", { name: "Email support@originpass.com" })).toBeVisible()
  })
})

