import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  BLOG_SITE_URL,
  blogPostCanonical,
  blogPostOgImage,
  getPost,
  getPostSlugs,
} from "@/lib/blog"

type Props = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  try {
    const post = await getPost(slug)
    const canonical = blogPostCanonical(post.slug)
    const ogImage = blogPostOgImage(post.slug)
    const title = `${post.title} | OriginPass`

    return {
      title,
      description: post.description,
      authors: [{ name: post.author, url: BLOG_SITE_URL }],
      keywords: post.primaryKeyword ? [post.primaryKeyword] : undefined,
      alternates: { canonical },
      openGraph: {
        type: "article",
        url: canonical,
        title: post.title,
        description: post.description,
        publishedTime: post.date,
        modifiedTime: post.updated ?? post.date,
        siteName: "OriginPass",
        locale: "en_US",
        authors: [post.author],
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: post.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description: post.description,
        images: [ogImage],
      },
    }
  } catch {
    return {}
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params

  let post
  try {
    post = await getPost(slug)
  } catch {
    notFound()
  }

  const canonical = blogPostCanonical(post.slug)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    image: blogPostOgImage(post.slug),
    author: {
      "@type": "Organization",
      name: post.author,
      url: BLOG_SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "OriginPass",
      url: BLOG_SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BLOG_SITE_URL}/brand/originpass-icon.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\u003c"),
        }}
      />
      <p className="mb-8 text-sm">
        <Link href="/blog" className="font-medium text-slate-600 hover:text-[#0B1F4D] hover:underline">
          All guides
        </Link>
      </p>
      <article>
        <header className="mb-10 border-b border-slate-200/80 pb-8">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-[#0B1F4D] md:text-[2.75rem] md:leading-tight">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-slate-600">{post.description}</p>
          <time className="mt-4 block text-sm text-slate-500" dateTime={post.updated ?? post.date}>
            Updated {post.updated ?? post.date}
          </time>
        </header>
        <div
          className="blog-prose"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
      <aside
        className="mt-14 rounded-2xl bg-[#0B1F4D] px-6 py-8 text-white shadow-[0_12px_40px_rgba(11,31,77,0.28)] sm:px-8"
        aria-label="Install OriginPass on the Shopify App Store"
      >
        <p className="text-xl font-semibold tracking-tight sm:text-2xl">
          Ready to Automate Your EU Digital Product Passports?
        </p>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/85">
          Scan your Shopify catalog and export print-ready GS1 QR hangtags in less than 5 minutes.
        </p>
        <a
          href="https://apps.shopify.com/originpass"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#C9A227] px-5 py-3 text-sm font-semibold text-[#0B1F4D] transition hover:bg-[#d4b03a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Install OriginPass on Shopify App Store
          <span aria-hidden className="ml-2">
            →
          </span>
        </a>
      </aside>
    </main>
  )
}
