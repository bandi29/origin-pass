import { createClient } from "@/lib/supabase/server"
import { isValidUuid } from "@/lib/security"
import type { RegulatoryExportBatchData } from "@/lib/regulatory-export"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params
  if (!isValidUuid(batchId)) {
    return Response.json({ error: "Invalid batch ID" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: batch, error } = await supabase
    .from("batches")
    .select(`
      id,
      production_run_name,
      artisan_name,
      location,
      produced_at,
      material_composition,
      maintenance_instructions,
      end_of_life_instructions,
      facility_info,
      product:products(id, name, story, materials, origin, lifecycle, image_url)
    `)
    .eq("id", batchId)
    .eq("brand_id", user.id)
    .single()

  if (error || !batch) {
    return Response.json({ error: "Batch not found" }, { status: 404 })
  }

  const { data: brand } = await supabase
    .from("profiles")
    .select("id, brand_name")
    .eq("id", user.id)
    .single()

  const { data: items } = await supabase
    .from("items")
    .select("id, serial_id")
    .eq("batch_id", batchId)
    .eq("brand_id", user.id)

  const itemList = items ?? []
  if (itemList.length === 0) {
    return Response.json(
      { error: "No items in batch to export" },
      { status: 400 }
    )
  }

  const product = Array.isArray(batch.product) ? batch.product[0] : batch.product
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")

  const data: RegulatoryExportBatchData = {
    batch: {
      id: batch.id,
      production_run_name: batch.production_run_name,
      artisan_name: batch.artisan_name,
      location: batch.location,
      produced_at: batch.produced_at,
      material_composition: batch.material_composition ?? [],
      maintenance_instructions: batch.maintenance_instructions,
      end_of_life_instructions: batch.end_of_life_instructions,
      facility_info: batch.facility_info,
    },
    product: {
      id: product?.id ?? "",
      name: product?.name ?? "Unknown Product",
      story: product?.story ?? null,
      materials: product?.materials ?? null,
      origin: product?.origin ?? null,
      lifecycle: product?.lifecycle ?? null,
      image_url: product?.image_url ?? null,
    },
    brand: {
      id: brand?.id ?? user.id,
      brand_name: brand?.brand_name ?? null,
    },
    items: itemList,
    baseUrl,
  }

  return Response.json(data)
}
