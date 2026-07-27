import type { Metadata } from "next"
import Link from "next/link"
import {
  blogIndexCanonical,
  blogIndexOgImage,
  getAllPosts,
} from "@/lib/blog"

const title = "Digital Product Passport Guides | OriginPass"
const description =
  "Practical guides for Shopify brands preparing product data, QR labels, and Digital Product Passports."

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: blogIndexCanonical(),
  },
  openGraph: {
    type: "website",
    url: blogIndexCanonical(),
    title,
    description,
    siteName: "OriginPass",
    locale: "en_US",
    images: [
      {
        url: blogIndexOgImage(),
        width: 1200,
        height: 630,
        alt: "OriginPass Digital Product Passport Guides",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [blogIndexOgImage()],
  },
}

export default async function BlogIndexPage() {
  const posts = await getAllPosts()

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-[#9A7B2E]">Guides</p>
      <h1 className="mt-2 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-[#0B1F4D] md:text-5xl">
        Digital Product Passport Guides
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Practical guidance for Shopify brands preparing for EU product-data and
        traceability requirements.
      </p>

      <ul className="mt-14 divide-y divide-slate-200/80 border-y border-slate-200/80">
        {posts.map((post) => (
          <li key={post.slug} className="py-8">
            <article>
              <time className="text-sm text-slate-500" dateTime={post.updated ?? post.date}>
                Updated {post.updated ?? post.date}
              </time>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0B1F4D]">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 max-w-3xl text-slate-600">{post.description}</p>
              <Link
                className="mt-5 inline-flex text-sm font-semibold text-[#0B1F4D] underline-offset-4 hover:underline"
                href={`/blog/${post.slug}`}
              >
                Read guide
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </main>
  )
}
