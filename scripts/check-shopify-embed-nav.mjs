#!/usr/bin/env node
/**
 * Static guardrail: Shopify embedded admin must never navigate the iframe to
 * SAMEORIGIN-blocked public paths (/sp, /shop, /p, /s, /scan) or leave bare
 * external document links without openOutsideShopifyEmbed.
 *
 * Run: node scripts/check-shopify-embed-nav.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve("src/app/(shopify-embedded)")
const BLOCKED_PATH_RE = /\/(sp|shop|p|s|scan)(\/|"|'|`|\?|#|$)/
const issues = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full)
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) scan(full)
  }
}

function scan(file) {
  const src = readFileSync(file, "utf8")
  const rel = path.relative(process.cwd(), file)
  const lines = src.split("\n")

  // Client UI that links passportHref must escape the iframe. Server URL builders are OK.
  if (/\.tsx$/.test(file) && /href=\{passportHref\}/.test(src) && !src.includes("openOutsideShopifyEmbed")) {
    issues.push(`${rel}: href={passportHref} without openOutsideShopifyEmbed`)
  }

  lines.forEach((line, i) => {
    const n = i + 1
    // Bare in-iframe navigation to blocked paths
    if (/location\.(href|assign)\s*=/.test(line) && BLOCKED_PATH_RE.test(line) && !/top/.test(line)) {
      issues.push(`${rel}:${n}: location assignment to iframe-blocked path`)
    }
    // <a href=.../sp/... without target=_blank/_top on same line (heuristic)
    if (/<a\b/.test(line) && BLOCKED_PATH_RE.test(line) && !/target=/.test(line)) {
      issues.push(`${rel}:${n}: anchor to iframe-blocked path missing target`)
    }
    // window.open(..., "_self") is never OK for escapes
    if (/window\.open\([^)]*["_']_self["_']/.test(line)) {
      issues.push(`${rel}:${n}: window.open(_, "_self") keeps navigation inside the iframe`)
    }
  })

  // Certificate / external document viewers in embed must import the helper.
  if (/viewUrl|supplierCertificate|confirmationUrl|connectUrl/.test(src) && /<a\b/.test(src)) {
    if (
      (rel.includes("CertificateField") || rel.includes("app-home/page")) &&
      /href=\{viewUrl\}|href=\{passportHref\}|confirmationUrl|connectUrl/.test(src) &&
      !src.includes("openOutsideShopifyEmbed")
    ) {
      issues.push(`${rel}: external/document navigation without openOutsideShopifyEmbed`)
    }
  }
}

if (!statSync(ROOT, { throwIfNoEntry: false })?.isDirectory()) {
  console.error("Missing shopify-embedded app directory:", ROOT)
  process.exit(1)
}

walk(ROOT)

if (issues.length) {
  console.error("Shopify embed navigation guardrail FAILED:\n")
  for (const issue of issues) console.error(" -", issue)
  console.error("\nUse openOutsideShopifyEmbed(url, \"blank\"|\"top\") from @/lib/shopify-embedded-url")
  process.exit(1)
}

console.log("Shopify embed navigation guardrail OK")
