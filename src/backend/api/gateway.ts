export type ApiSuccess<T> = {
  ok: true
  traceId: string
  data: T
}

export type ApiError = {
  ok: false
  traceId: string
  error: string
}

export function ok<T>(traceId: string, data: T, status = 200) {
  const body: ApiSuccess<T> = { ok: true, traceId, data }
  return Response.json(body, { status })
}

export function fail(traceId: string, error: string, status = 400) {
  const body: ApiError = { ok: false, traceId, error }
  return Response.json(body, { status })
}
