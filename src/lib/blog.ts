import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { remark } from "remark"
import html from "remark-html"
import remarkGfm from "remark-gfm"

const postsDirectory = path.join(process.cwd(), "src/content/blog")

export const BLOG_SITE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL ?? "https://origin-pass.vercel.app").replace(/\/$/, "")

export type BlogPostMeta = {
  slug: string
  title: string
  description: string
  date: string
  updated?: string
  author: string
  primaryKeyword?: string
}

export type BlogPost = BlogPostMeta & {
  contentHtml: string
}

export function getPostSlugs(): string[] {
  if (!fs.existsSync(postsDirectory)) return []
  return fs
    .readdirSync(postsDirectory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""))
}

export async function getPost(slug: string): Promise<BlogPost> {
  const safeSlug = path.basename(slug)
  const filePath = path.join(postsDirectory, `${safeSlug}.md`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown blog post: ${safeSlug}`)
  }
  const file = fs.readFileSync(filePath, "utf8")
  const { data, content } = matter(file)
  const rendered = await remark().use(remarkGfm).use(html).process(content)

  return {
    slug: typeof data.slug === "string" && data.slug ? data.slug : safeSlug,
    title: String(data.title ?? safeSlug),
    description: String(data.description ?? ""),
    date: String(data.date ?? ""),
    updated: data.updated ? String(data.updated) : undefined,
    author: String(data.author ?? "OriginPass"),
    primaryKeyword: data.primaryKeyword ? String(data.primaryKeyword) : undefined,
    contentHtml: rendered.toString(),
  }
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const posts = await Promise.all(getPostSlugs().map(getPost))
  return posts.sort((a, b) => b.date.localeCompare(a.date))
}

export function blogPostCanonical(slug: string): string {
  return `${BLOG_SITE_URL}/blog/${slug}`
}

export function blogIndexCanonical(): string {
  return `${BLOG_SITE_URL}/blog`
}

/** Absolute Open Graph image URL for a post (file convention + explicit meta). */
export function blogPostOgImage(slug: string): string {
  return `${BLOG_SITE_URL}/blog/${slug}/opengraph-image`
}

export function blogIndexOgImage(): string {
  return `${BLOG_SITE_URL}/blog/opengraph-image`
}

/** Public guide routes (unprefixed; keep outside next-intl Link). */
export const BLOG_PATHS = {
  home: "/blog",
  espr: "/blog/eu-espr-compliance-shopify-apparel-brands",
  gs1: "/blog/gs1-digital-link-qr-code-clothing-hangtags",
} as const

export const BLOG_GUIDE_LINKS = [
  {
    key: "espr",
    label: "EU ESPR Compliance Guide",
    href: BLOG_PATHS.espr,
    shortLabel: "EU ESPR guide",
  },
  {
    key: "gs1",
    label: "GS1 QR Hangtag Tutorial",
    href: BLOG_PATHS.gs1,
    shortLabel: "GS1 QR hangtags",
  },
] as const

export function blogAbsolutePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${BLOG_SITE_URL}${normalized}`
}

