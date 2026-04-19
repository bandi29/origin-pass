import { getCategorySchemaPublicJson } from "@/lib/compliance/category-schemas"

export const runtime = "nodejs"

type Params = { type: string }

export async function GET(_req: Request, context: { params: Promise<Params> }) {
  const { type } = await context.params
  const decoded = decodeURIComponent(type)
  const schema = getCategorySchemaPublicJson(decoded)
  if (!schema) {
    return Response.json({ error: "Unknown category type" }, { status: 404 })
  }
  return Response.json(schema)
}
