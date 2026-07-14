import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

let scanned = false

/** Populated from `.env.local` file contents (not from `process.env` reads). Next/Turbopack can supply a frozen env object where assignments do not stick. */
const visionFromFile: {
  gemini?: string
  openai?: string
  geminiVisionModel?: string
} = {}

/** Names that hold a Google AI Studio / Gemini API key (AIza…). */
const GEMINI_KEY_NAMES = new Set([
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_API_KEY",
])

function walkUpDirs(start: string, maxDepth: number): string[] {
  const out: string[] = []
  let d = path.resolve(start)
  for (let i = 0; i < maxDepth; i++) {
    out.push(d)
    const parent = path.dirname(d)
    if (parent === d) break
    d = parent
  }
  return out
}

function moduleDirname(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url))
  } catch {
    return process.cwd()
  }
}

function orderedEnvLocalCandidates(): string[] {
  const seen = new Set<string>()
  const add = (p: string) => {
    const n = path.normalize(p)
    if (!seen.has(n)) seen.add(n)
  }

  for (const dir of walkUpDirs(process.cwd(), 20)) {
    add(path.join(dir, ".env.local"))
  }
  for (const dir of walkUpDirs(moduleDirname(), 25)) {
    add(path.join(dir, ".env.local"))
  }

  return [...seen]
}

function applyEnvLocalFile(envPath: string): void {
  let content = fs.readFileSync(envPath, "utf8")
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)

  for (const line of content.split("\n")) {
    const trimmed = line.replace(/\r$/, "").trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    let key = trimmed.slice(0, eq).trim()
    if (key.startsWith("export")) key = key.slice(6).trim()
    if (!key) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    try {
      process.env[key] = value
    } catch {
      /* ignore if env is frozen */
    }

    const v = value.trim()
    if (!v) continue
    if (GEMINI_KEY_NAMES.has(key)) visionFromFile.gemini = v
    if (key === "OPENAI_API_KEY") visionFromFile.openai = v
    if (key === "GEMINI_VISION_MODEL") visionFromFile.geminiVisionModel = v
  }
}

/**
 * Parses the nearest `.env.local` into `process.env` (when writable) and into `visionFromFile`.
 */
export function loadEnvLocalIntoProcess(): void {
  if (scanned) return
  scanned = true

  for (const envPath of orderedEnvLocalCandidates()) {
    if (!fs.existsSync(envPath)) continue
    try {
      applyEnvLocalFile(envPath)
      if (process.env.NODE_ENV === "development") {
        console.info("[env-local-file] Loaded", envPath)
      }
      return
    } catch (e) {
      console.warn("[env-local-file] Failed reading", envPath, e)
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[env-local-file] No .env.local found (searched upward from cwd=%s and from module dir=%s)",
      process.cwd(),
      moduleDirname(),
    )
  }
}

function fromProcessGemini(): string | undefined {
  const a = process.env["GEMINI_API_KEY"]?.trim()
  const b = process.env["GOOGLE_AI_API_KEY"]?.trim()
  const c = process.env["GOOGLE_GENERATIVE_AI_API_KEY"]?.trim()
  const d = process.env["GOOGLE_API_KEY"]?.trim()
  return a || b || c || d
}

function fromProcessOpenAI(): string | undefined {
  return process.env["OPENAI_API_KEY"]?.trim()
}

/** Gemini / Google AI Studio API key (file first, then platform env e.g. Vercel). */
export function resolveGeminiApiKey(): string | undefined {
  loadEnvLocalIntoProcess()
  return visionFromFile.gemini || fromProcessGemini()
}

export function resolveOpenaiApiKey(): string | undefined {
  loadEnvLocalIntoProcess()
  return visionFromFile.openai || fromProcessOpenAI()
}

export function resolveGeminiVisionModel(): string {
  loadEnvLocalIntoProcess()
  return (
    visionFromFile.geminiVisionModel ||
    process.env["GEMINI_VISION_MODEL"]?.trim() ||
    "gemini-1.5-flash"
  )
}
