import type { MetadataRoute } from "next"
import { BLOG_SITE_URL, getAllPosts } from "@/lib/blog"

/**
 * Dynamic sitemap — every Markdown file in src/content/blog is listed automatically
 * so Google can discover new guides without a manual sitemap edit.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts()
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BLOG_SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BLOG_SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BLOG_SITE_URL}/compliance`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BLOG_SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ]

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BLOG_SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date ?? now.toISOString()),
    changeFrequency: "monthly",
    priority: 0.85,
  }))

  return [...staticRoutes, ...blogRoutes]
}
