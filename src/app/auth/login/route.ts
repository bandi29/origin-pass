import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { createClient } from "@/lib/supabase/server"

type LoginBody = {
  email?: string
  password?: string
}

export async function POST(request: Request) {
  const ctx = await buildRequestContext()
  let body: LoginBody

  try {
    body = (await request.json()) as LoginBody
  } catch {
    return fail(ctx.traceId, "Invalid JSON body.", 400)
  }

  const email = body.email?.trim()
  const password = body.password

  if (!email || !password) {
    return fail(ctx.traceId, "email and password are required.", 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return fail(ctx.traceId, "Invalid login credentials.", 401)
  }

  return ok(ctx.traceId, {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  })
}
