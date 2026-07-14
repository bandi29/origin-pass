import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { PassportRegistryClientBlock } from "@/components/passports/PassportRegistryClientBlock"
import { getPassportRegistryRowsForUser } from "@/lib/passport-registry-server"

type SearchParams = { view?: string }

export default async function PassportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const params = await searchParams
    const viewThisMonth = params?.view === 'this-month'

    const registryRows = await getPassportRegistryRowsForUser(user.id, { viewThisMonth })
    const viewKey = viewThisMonth ? "this-month" : "all"

    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Product Passports</h1>
                <p className="text-slate-500 mt-2">
                    {viewThisMonth ? 'Passports generated this month' : 'All generated digital product passports'}
                </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-12px_rgba(15,23,42,0.08)]">
                <PassportRegistryClientBlock
                    rows={registryRows}
                    viewKey={viewKey}
                    viewThisMonth={viewThisMonth}
                    totalCount={registryRows.length}
                />
            </div>
        </div>
    )
}
