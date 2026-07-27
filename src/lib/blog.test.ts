import { describe, expect, it } from "vitest"
import {
  blogPostCanonical,
  blogPostOgImage,
  getAllPosts,
  getPost,
  getPostSlugs,
} from "@/lib/blog"
import {
  blogPostCanonical as canonicalFromLinks,
  blogPostOgImage as ogFromLinks,
} from "@/lib/blog-links"

describe("blog content", () => {
  it("lists the published guide slugs", () => {
    const slugs = getPostSlugs().sort()
    expect(slugs).toEqual([
      "eu-espr-compliance-shopify-apparel-brands",
      "gs1-digital-link-qr-code-clothing-hangtags",
    ])
  })

  it("loads frontmatter and html for each post", async () => {
    const posts = await getAllPosts()
    expect(posts).toHaveLength(2)
    for (const post of posts) {
      expect(post.title.length).toBeGreaterThan(10)
      expect(post.description.length).toBeGreaterThan(20)
      expect(post.contentHtml).toContain("<")
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it("builds canonical and og image URLs for SEO", () => {
    const slug = "gs1-digital-link-qr-code-clothing-hangtags"
    expect(blogPostCanonical(slug)).toBe(
      "https://origin-pass.vercel.app/blog/gs1-digital-link-qr-code-clothing-hangtags",
    )
    expect(blogPostOgImage(slug)).toBe(
      "https://origin-pass.vercel.app/blog/gs1-digital-link-qr-code-clothing-hangtags/opengraph-image",
    )
    expect(canonicalFromLinks(slug)).toBe(blogPostCanonical(slug))
    expect(ogFromLinks(slug)).toBe(blogPostOgImage(slug))
  })

  it("rejects path traversal slugs", async () => {
    await expect(getPost("../package")).rejects.toThrow()
  })
})
