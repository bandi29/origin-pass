import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from "@/lib/supabase/admin"

async function ensureOrganizationAndUserRows(user: User, brandName: string) {
    try {
        const admin = createAdminClient()
        await admin.from("organizations").upsert({
            id: user.id,
            name: brandName,
        })
        await admin.from("users").upsert({
            id: user.id,
            email: user.email ?? null,
            name: user.user_metadata?.full_name ?? brandName,
            organization_id: user.id,
            role: "owner",
        })
    } catch (error) {
        // Keep legacy profile flow resilient if additive tables are unavailable.
        console.warn("Organization/user sync skipped:", error)
    }
}

export async function ensureBrandProfile(
    supabase: SupabaseClient,
    user: User
) {
    const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id, brand_name, subscription_status, created_at')
        .eq('id', user.id)
        .maybeSingle()

    if (existingError) {
        throw existingError
    }

    const derivedBrandName =
        user.user_metadata?.brand_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'My Brand'

    if (existing) {
        await ensureOrganizationAndUserRows(user, existing.brand_name || derivedBrandName)
        return existing
    }

    const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({
            id: user.id,
            brand_name: derivedBrandName,
        })
        .select('id, brand_name, subscription_status, created_at')
        .single()

    if (createError) {
        if (createError.code === '23505') {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, brand_name')
                .eq('id', user.id)
                .single()
            if (error) throw error
            return data
        }
        throw createError
    }

    await ensureOrganizationAndUserRows(user, created.brand_name || derivedBrandName)
    return created
}
