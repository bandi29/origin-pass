import { createClient } from '@supabase/supabase-js'
import { logSupabaseHostInDev } from '@/lib/supabase/log-env'

export const createAdminClient = () => {
    logSupabaseHostInDev()
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
