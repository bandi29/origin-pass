import { NextResponse } from "next/server"

const SAMPLE = `product_name,product_id,category,brand,origin_country,material,batch_number,manufacture_date,certifications,qr_code
Heritage Leather Tote,SKU-LEATHER-001,Accessories,Aurum Atelier,Italy,Vegetable-tanned leather,BATCH-AW-26,2025-03-15,"EU Ecolabel|OEKO-TEX",
Artisan Ceramic Vase,SKU-CER-442,Home,Craft House,Portugal,Ceramic clay,LOT-12,2025-01-10,GOTS,
`

export async function GET() {
  return new NextResponse(SAMPLE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="originpass-product-import-template.csv"',
    },
  })
}
