import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * OAuth / magic-link callback: exchanges PKCE `code` for a session and redirects.
 * Password reset recovery is handled on `/[locale]/reset-password` (client exchanges code).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin, pathname } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")

  const locale = pathname.split("/")[1] || "en"
  const fallbackRedirect = `/${locale}/dashboard`
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : fallbackRedirect

  const response = NextResponse.redirect(new URL(safeNext, origin))

  if (!code) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/${locale}/login?error=auth_callback&reason=${encodeURIComponent(error.message)}`,
        origin
      )
    )
  }

  return response
}

