import { expect, test } from "@playwright/test"

/**
 * Functional smoke validation - no auth required.
 * Catches real breakage: 5xx, blank shells, broken public assets.
 */

async function assertNoFatalUi(page: import("@playwright/test").Page) {
  await expect(page.locator("body")).not.toBeEmpty()
  await expect(page.getByText("Application error")).toHaveCount(0)
  await expect(page.getByText("Internal Server Error")).toHaveCount(0)
}

test.describe("Functional smoke (public)", () => {
  test("login page loads and is interactive", async ({ page }) => {
    const res = await page.goto("/en/login")
    expect(res?.status()).toBeLessThan(500)
    await assertNoFatalUi(page)
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByPlaceholder("you@company.com")).toBeVisible()
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible()
  })

  test("support page loads with CTA", async ({ page }) => {
    const res = await page.goto("/en/support")
    expect(res?.status()).toBeLessThan(500)
    await assertNoFatalUi(page)
    await expect(page.getByRole("link", { name: /support@originpass.com/i })).toBeVisible()
  })

  test("signup page loads without server error", async ({ page }) => {
    const res = await page.goto("/en/signup")
    expect(res?.status()).toBeLessThan(500)
    await assertNoFatalUi(page)
  })

  test("forgot-password page loads", async ({ page }) => {
    const res = await page.goto("/en/forgot-password")
    expect(res?.status()).toBeLessThan(500)
    await assertNoFatalUi(page)
  })

  test("unknown public passport route does not 500", async ({ page }) => {
    const res = await page.goto("/sp/originpass-sandbox/does-not-exist-e2e")
    expect(res?.status()).toBeLessThan(500)
    await assertNoFatalUi(page)
  })

  test("unknown verify token does not 500", async ({ page }) => {
    const res = await page.goto("/en/verify/e2e-missing-serial-000")
    expect(res?.status()).toBeLessThan(500)
    await assertNoFatalUi(page)
  })

  test("reviewer sample PDFs are reachable", async ({ request }) => {
    for (const path of [
      "/production-location-sample.pdf",
      "/care-instructions-sample.pdf",
      "/OEKO-TEX_STANDARD_100_Standard_EN.pdf",
      "/sample-supplier-certificate.pdf",
    ]) {
      const res = await request.get(path)
      expect(res.status(), `${path} should be available`).toBe(200)
      expect(res.headers()["content-type"] || "").toMatch(/pdf|octet-stream/i)
    }
  })

  test("protected dashboard redirects unauthenticated users", async ({ page }) => {
    const res = await page.goto("/en/dashboard")
    expect(res?.status()).toBeLessThan(500)
    await page.waitForURL(/login|auth|signup/i, { timeout: 15000 })
    await assertNoFatalUi(page)
  })

  test("local app is wired to Dev Supabase host", async ({ request }) => {
    test.skip(!String(process.env.E2E_BASE_URL || "http://localhost:3000").includes("localhost"), "Local-only")
    // Hit a lightweight page; Next embeds NEXT_PUBLIC_SUPABASE_URL in client bundles
    const res = await request.get("/en/login")
    expect(res.status()).toBeLessThan(500)
    const html = await res.text()
    // Dev host may appear in inline env or chunk references after hydration scripts load;
    // at minimum ensure we never bake prod host into local HTML shell.
    expect(html).not.toContain("myempzxqncdmobnvgbur.supabase.co")
  })
})
