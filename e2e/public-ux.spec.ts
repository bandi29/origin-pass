import { expect, test } from "@playwright/test"

test.describe("Public UX basics", () => {
  test("login page shows email/password sign-in", async ({ page }) => {
    await page.goto("/en/login")
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByPlaceholder("you@company.com")).toBeVisible()
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible()
  })

  test("support page shows required markers and clear CTA", async ({ page }) => {
    await page.goto("/en/support")
    await expect(page.getByRole("main").getByText("* Required fields")).toBeVisible()
    await expect(page.getByRole("link", { name: "Email support@originpass.com" })).toBeVisible()
  })
})
