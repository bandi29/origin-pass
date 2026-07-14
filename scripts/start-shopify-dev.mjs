#!/usr/bin/env node
/**
 * Single entry for embedded-app development — starts `shopify app dev`
 * (tunnel + Next.js + dev-store URL override).
 *
 * Do NOT run `npm run dev` in a separate terminal.
 */
import { execSync, spawn } from "node:child_process"

const store = process.env.SHOPIFY_DEV_STORE || "originpass-sandbox.myshopify.com"
const useLocalhost = process.env.SHOPIFY_USE_LOCALHOST === "1"

/** Avoid stale tunnels / duplicate Next on :3000 that leave the admin iframe blank. */
function stopStaleDevProcesses() {
  try {
    execSync("lsof -ti :3000 | xargs kill 2>/dev/null || true", { stdio: "ignore", shell: true })
    execSync("pkill -f 'shopify app dev' 2>/dev/null || true", { stdio: "ignore", shell: true })
  } catch {
    // best-effort
  }
}

stopStaleDevProcesses()

const args = ["shopify", "app", "dev", "--store", store]
if (useLocalhost) args.push("--use-localhost")

console.log(`[shopify-dev] Starting shopify app dev for ${store}`)
if (useLocalhost) {
  console.log("[shopify-dev] Localhost mode (no tunnel). Webhooks will not reach this machine.")
} else {
  console.log("[shopify-dev] Cloudflare tunnel mode. Keep this terminal open — closing it breaks the admin iframe.")
}
console.log("[shopify-dev] Open the Preview URL from the CLI, then click Web in Dev Console.")
console.log("[shopify-dev] After start, run: npm run shopify:embed:check")
console.log("[shopify-dev] Hard-refresh the Shopify admin tab after each restart (tunnel URL changes).")
console.log("[shopify-dev] originpass.com is NOT deployed yet — sidebar alone will stay blank without this dev server.")

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
})
child.on("exit", (code) => process.exit(code ?? 0))
