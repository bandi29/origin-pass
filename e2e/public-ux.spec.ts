import { expect, test } from "@playwright/test"

test.describe("Login page", () => {
  test("renders email and password fields with correct placeholders", async ({ page }) => {
    await page.goto("/en/login")
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByPlaceholder("you@company.com")).toBeVisible()
    await expect(page.getByPlaceholder("••••••••")).toBeVisible()
  })

  test("shows Sign in button", async ({ page }) => {
    await page.goto("/en/login")
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
  })

  test("shows forgot password link", async ({ page }) => {
    await page.goto("/en/login")
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible()
  })

  test("can switch to email link (magic) mode", async ({ page }) => {
    await page.goto("/en/login")
    await page.getByRole("button", { name: "Email link" }).click()
    await expect(page.getByRole("button", { name: "Continue with email link" })).toBeVisible()
    // Password field should be hidden in magic link mode
    await expect(page.getByPlaceholder("••••••••")).not.toBeVisible()
  })

  test("shows sign up link", async ({ page }) => {
    await page.goto("/en/login")
    await expect(page.getByRole("link", { name: /sign up|no account/i })).toBeVisible()
  })
})

test.describe("Support page", () => {
  test("shows required fields marker and support email", async ({ page }) => {
    await page.goto("/en/support")
    await expect(page.getByText("Required fields")).toBeVisible()
    await expect(page.getByRole("link", { name: /support@originpass\.com/i })).toBeVisible()
  })
})

test.describe("Marketing / Home page", () => {
  test("home page loads without error", async ({ page }) => {
    await page.goto("/en")
    await expect(page).toHaveTitle(/OriginPass/)
  })
})

test.describe("Auth redirect", () => {
  test("unauthenticated visit to /dashboard redirects to login", async ({ page }) => {
    await page.goto("/en/dashboard")
    await page.waitForURL(/\/login/)
    await expect(page.getByPlaceholder("you@company.com")).toBeVisible()
  })
})


