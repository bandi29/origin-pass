'use server'

import { createClient } from '@/lib/supabase/server'
import { generateSerialId } from '@/lib/crypto'
import { reportUsage } from '@/lib/paddle'
import { ensureBrandProfile } from '@/lib/tenancy'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'

export interface CreateBatchResult {
    success: boolean
    batchId?: string
    codes?: { serialId: string; qrCodeUrl: string }[]
    error?: string
}

export interface BatchDetails {
    productionRunName: string
    artisanName: string
    location: string
    producedAt: string
    materialComposition?: { material: string; percentage: number }[]
    maintenanceInstructions?: string | null
    endOfLifeInstructions?: string | null
    facilityInfo?: string | null
}

function toFriendlyBatchError(message?: string): string {
    const text = String(message || "").toLowerCase()
    if (!text) return "We couldn't create the batch right now. Please try again."
    if (text.includes("unauthorized")) return "Your session has expired. Please sign in again."
    if (text.includes("product not found")) return "We couldn't find the selected product. Please refresh and try again."
    if (text.includes("schema cache") || text.includes("column")) {
        return "We couldn't save the batch due to a temporary setup issue. Please try again in a moment."
    }
    return "We couldn't create the batch right now. Please try again."
}

export async function createBatchAndCodes(
    productId: string,
    batchDetails: BatchDetails,
    quantity: number
): Promise<CreateBatchResult> {
    const supabase = await createClient()

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: toFriendlyBatchError('Unauthorized') }
    }

    await ensureBrandProfile(supabase, user)

    // Ensure product belongs to the authenticated brand
    const { data: ownedProduct, error: ownedProductError } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .eq('brand_id', user.id)
        .maybeSingle()

    if (ownedProductError || !ownedProduct) {
        return { success: false, error: toFriendlyBatchError('Product not found') }
    }

    // 2. Insert Batch
    const insertPayload: Record<string, unknown> = {
        brand_id: user.id,
        product_id: ownedProduct.id,
        production_run_name: batchDetails.productionRunName,
        artisan_name: batchDetails.artisanName,
        location: batchDetails.location,
        produced_at: batchDetails.producedAt,
    }

    if (batchDetails.materialComposition?.length) {
        insertPayload.material_composition = batchDetails.materialComposition
    }
    if (batchDetails.maintenanceInstructions != null) {
        insertPayload.maintenance_instructions = batchDetails.maintenanceInstructions
    }
    if (batchDetails.endOfLifeInstructions != null) {
        insertPayload.end_of_life_instructions = batchDetails.endOfLifeInstructions
    }
    if (batchDetails.facilityInfo != null) {
        insertPayload.facility_info = batchDetails.facilityInfo
    }

    const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert(insertPayload)
        .select()
        .single()

    if (batchError || !batch) {
        return { success: false, error: toFriendlyBatchError(batchError?.message || 'Failed to create batch') }
    }

    // 3. Generate Items
    const itemsToInsert = []
    const codes = []
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    for (let i = 0; i < quantity; i++) {
        const serialId = generateSerialId()
        itemsToInsert.push({
            brand_id: user.id,
            batch_id: batch.id,
            serial_id: serialId,
        })

        const url = `${baseUrl}/verify/${serialId}`
        try {
            const qrCodeUrl = await QRCode.toDataURL(url)
            codes.push({ serialId, qrCodeUrl })
        } catch (e) {
            console.error('QR Gen Error', e)
        }
    }

    // 4. Insert Items
    const { error: itemsError } = await supabase.from('items').insert(itemsToInsert)

    if (itemsError) {
        return { success: false, error: toFriendlyBatchError(itemsError.message) }
    }

    // 4b. Dual-write into scalable passport table for transition compatibility.
    try {
        const admin = createAdminClient()
        const passportsPayload = itemsToInsert.map((item) => ({
            passport_uid: String(item.serial_id),
            product_id: ownedProduct.id,
            serial_number: String(item.serial_id),
            status: 'active',
        }))

        const { error: passportWriteError } = await admin
            .from('passports')
            .upsert(passportsPayload, { onConflict: 'serial_number' })

        if (passportWriteError) {
            console.warn('Dual-write passports warning:', passportWriteError.message)
        }
    } catch (error) {
        console.warn('Dual-write passports skipped:', error)
    }

    // 5. Log Usage & Report to Paddle
    // Look up profile for subscription ID
    const { data: profile } = await supabase.from('profiles').select('paddle_subscription_id').eq('id', user.id).single()

    if (profile?.paddle_subscription_id) {
        await reportUsage(profile.paddle_subscription_id, quantity)
    }

    await supabase.from('usage_logs').insert({
        brand_id: user.id,
        event_type: 'item_created',
    })

    // Return codes (UI can handle ZIP generation or display)
    return { success: true, batchId: batch.id, codes }
}
