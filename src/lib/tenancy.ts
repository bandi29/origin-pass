import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from "@/lib/supabase/admin"

type CachedProfile = {
    id: string
    brand_name: string | null
    subscription_status?: string | null
    created_at?: string | null
}

/**
 * Per-process cache to avoid re-upserting organization/user rows on every authenticated
 * API call. Profile data is fetched once per TTL window per user; org/user bootstrap
 * runs at most once per process per user. This is best-effort (cache is per instance)
 * but turns hot paths from ~30ms+ to a no-op.
 */
const PROFILE_TTL_MS = 5 * 60 * 1000
const profileCache = new Map<string, { value: CachedProfile; expiresAt: number }>()
const bootstrappedUserIds = new Set<string>()

async function ensureOrganizationAndUserRows(user: User, brandName: string) {
    if (bootstrappedUserIds.has(user.id)) return
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
        bootstrappedUserIds.add(user.id)
    } catch (error) {
        // Keep legacy profile flow resilient if additive tables are unavailable.
        console.warn("Organization/user sync skipped:", error)
    }
}

function getCachedProfile(userId: string): CachedProfile | null {
    const entry = profileCache.get(userId)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
        profileCache.delete(userId)
        return null
    }
    return entry.value
}

function setCachedProfile(userId: string, value: CachedProfile): void {
    profileCache.set(userId, { value, expiresAt: Date.now() + PROFILE_TTL_MS })
    if (profileCache.size > 5000) {
        const now = Date.now()
        for (const [k, v] of profileCache) {
            if (v.expiresAt < now) profileCache.delete(k)
        }
    }
}

export async function ensureBrandProfile(
    supabase: SupabaseClient,
    user: User
) {
    const cached = getCachedProfile(user.id)
    if (cached) {
        // Fast-path: profile is known, org/user bootstrap already ran for this process.
        return cached
    }

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
        setCachedProfile(user.id, existing as CachedProfile)
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
            if (data) setCachedProfile(user.id, data as CachedProfile)
            return data
        }
        throw createError
    }

    await ensureOrganizationAndUserRows(user, created.brand_name || derivedBrandName)
    setCachedProfile(user.id, created as CachedProfile)
    return created
}
