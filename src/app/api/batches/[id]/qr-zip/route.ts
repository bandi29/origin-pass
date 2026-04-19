import { createClient } from "@/lib/supabase/server"
import QRCode from "qrcode"
import JSZip from "jszip"
import { isValidUuid, sanitizeForFilename } from "@/lib/security"

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
        .select("id")
        .eq("id", batchId)
        .eq("brand_id", user.id)
        .single()

    if (error || !batch) {
        return Response.json({ error: "Batch not found" }, { status: 404 })
    }

    const { data: items } = await supabase
        .from("items")
        .select("id, serial_id")
        .eq("batch_id", batchId)
        .eq("brand_id", user.id)

    const itemList = items ?? []
    if (itemList.length === 0) {
        return Response.json({ error: "No codes in batch" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const zip = new JSZip()

    for (const item of itemList) {
        const url = `${baseUrl}/verify/${item.serial_id}`
        const pngBuffer = await QRCode.toBuffer(url, { type: "png", width: 256, margin: 2 })
        zip.file(`${sanitizeForFilename(item.serial_id)}.png`, pngBuffer)
    }

    const zipBuffer = await zip.generateAsync({ type: "uint8array" })
    const filename = `originpass-qr-codes-${batchId.slice(0, 8)}.zip`
    const blob = new Blob([zipBuffer as BlobPart], { type: "application/zip" })

    return new Response(blob, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    })
}
