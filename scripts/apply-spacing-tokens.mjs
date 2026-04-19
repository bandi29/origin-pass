/**
 * Replaces literal space-y-6/8 on page wrappers with spacing tokens + adds import.
 * Run: node scripts/apply-spacing-tokens.mjs
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcApp = path.join(__dirname, "../src/app")

function walk(dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (name.endsWith(".tsx")) out.push(p)
  }
  return out
}

function ensureImport(content) {
  if (/\bspacing\b/.test(content) && content.includes("@/design-system/tokens")) {
    if (/import\s*\{[^}]*\bspacing\b[^}]*\}\s*from\s*["']@\/design-system\/tokens["']/.test(content)) {
      return content
    }
  }
  const tokensImport = /import\s*\{([^}]*)\}\s*from\s*["']@\/design-system\/tokens["']/
  const m = content.match(tokensImport)
  if (m) {
    const inner = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (!inner.includes("spacing")) inner.unshift("spacing")
    return content.replace(tokensImport, `import { ${inner.join(", ")} } from "@/design-system/tokens"`)
  }
  const imp = `import { spacing } from "@/design-system/tokens"\n`
  if (content.startsWith('"use client"')) {
    const i = content.indexOf("\n")
    return content.slice(0, i + 1) + imp + content.slice(i + 1)
  }
  return imp + content
}

function processFile(file) {
  let s = fs.readFileSync(file, "utf8")
  const orig = s
  if (!s.includes("space-y-6") && !s.includes("space-y-8")) return false

  s = s.replaceAll('className="space-y-8"', "className={spacing.pageStack}")
  s = s.replaceAll('FadeIn className="space-y-8"', "FadeIn className={spacing.pageStack}")
  s = s.replaceAll('<form className="space-y-6"', "<form className={spacing.stackDense}")
  s = s.replaceAll('FadeIn className="space-y-6"', "FadeIn className={spacing.pageStack}")
  s = s.replaceAll('className="space-y-6"', "className={spacing.pageStack}")

  if (s.includes("<form className={spacing.pageStack}")) {
    s = s.replace("<form className={spacing.pageStack}", "<form className={spacing.stackDense}")
  }

  if (s === orig) return false

  s = ensureImport(s)
  fs.writeFileSync(file, s)
  return true
}

let n = 0
for (const f of walk(srcApp)) {
  if (processFile(f)) {
    console.log("updated", path.relative(process.cwd(), f))
    n++
  }
}
console.log("files updated:", n)
