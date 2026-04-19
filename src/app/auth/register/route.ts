import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { createClient } from "@/lib/supabase/server"

type RegisterBody = {
  email?: string
  password?: string
  brandName?: string
  fullName?: string
}

export async function POST(request: Request) {
  const ctx = await buildRequestContext()
  let body: RegisterBody

  try {
    body = (await request.json()) as RegisterBody
  } catch {
    return fail(ctx.traceId, "Invalid JSON body.", 400)
  }

  const email = body.email?.trim()
  const password = body.password

  if (!email || !password) {
    return fail(ctx.traceId, "email and password are required.", 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        brand_name: body.brandName?.trim() || undefined,
        full_name: body.fullName?.trim() || undefined,
      },
    },
  })

  if (error || !data.user) {
    return fail(ctx.traceId, error?.message || "Registration failed.", 400)
  }

  return ok(
    ctx.traceId,
    {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      needsEmailConfirmation: !data.session,
    },
    201
  )
}
