import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"
import { Settings as SettingsIcon, User, Building2, LogOut } from "lucide-react"
import ProfileSettingsForm from "@/components/dashboard/ProfileSettingsForm"
import LogoutButton from "@/components/dashboard/LogoutButton"
import { Link } from "@/i18n/navigation"

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    let brandProfile: { brand_name?: string | null } | null = null

    try {
        brandProfile = await ensureBrandProfile(supabase, user)
    } catch (error) {
        console.error('Brand profile error:', error)
    }

    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
                <p className="text-slate-500 mt-2">Manage your account and brand preferences</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Link href="/dashboard/settings/profile" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Profile</Link>
                    <Link href="/dashboard/settings/security" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Security</Link>
                    <Link href="/dashboard/settings/branding" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Branding</Link>
                    <Link href="/dashboard/settings/notifications" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Notifications</Link>
                    <Link href="/dashboard/settings/developer-settings" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Developer Settings</Link>
                </div>
            </div>

            {/* Account Info */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <User className="w-5 h-5 text-slate-400" />
                    <h2 className="text-xl font-semibold">Account Information</h2>
                </div>
                <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">Email</span>
                        <span className="font-medium text-slate-900">{user.email || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">User ID</span>
                        <span className="font-mono text-xs text-slate-600">{user.id.slice(0, 8)}…</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-slate-500">Account Created</span>
                        <span className="text-slate-600">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                </div>
            </div>

            {/* Brand Settings */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <Building2 className="w-5 h-5 text-slate-400" />
                    <h2 className="text-xl font-semibold">Brand Settings</h2>
                </div>
                <ProfileSettingsForm brandName={brandProfile?.brand_name || null} />
            </div>

            {/* Privacy Notice */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                <p className="text-xs text-blue-800">
                    🔒 Your data is private and visible only to your brand. We do not share or sell your information.
                </p>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-2xl border border-rose-200 p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <LogOut className="w-5 h-5 text-rose-500" />
                    <h2 className="text-xl font-semibold text-slate-900">Account Actions</h2>
                </div>
                <div className="space-y-4">
                    <LogoutButton />
                    <p className="text-xs text-slate-400">
                        Need to delete your account? Contact support for assistance.
                    </p>
                </div>
            </div>
        </div>
    )
}
