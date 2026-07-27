import type { MetadataRoute } from "next"
import { BLOG_SITE_URL } from "@/lib/blog"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/blog",
          "/blog/",
          "/pricing",
          "/compliance",
          "/documentation",
          "/sitemap.xml",
        ],
        disallow: [
          "/api/",
          "/dashboard/",
          "/auth/",
          "/en/dashboard",
          "/fr/dashboard",
          "/it/dashboard",
        ],
      },
    ],
    sitemap: `${BLOG_SITE_URL}/sitemap.xml`,
    host: BLOG_SITE_URL,
  }
}
