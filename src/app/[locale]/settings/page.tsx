import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { User, Users, CreditCard, Shield } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

export default function SettingsPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Settings"
        description="Manage your account and organization."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/settings/account"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <User className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Account</h2>
            <p className="text-sm text-slate-500">Profile and preferences</p>
          </div>
        </Link>
        <Link
          href="/settings/team"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Users className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Team</h2>
            <p className="text-sm text-slate-500">Team members</p>
          </div>
        </Link>
        <Link
          href="/settings/billing"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <CreditCard className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Billing</h2>
            <p className="text-sm text-slate-500">Subscription and billing</p>
          </div>
        </Link>
        <Link
          href="/settings/security"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Shield className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Security</h2>
            <p className="text-sm text-slate-500">Security settings</p>
          </div>
        </Link>
      </div>
    </FadeIn>
  )
}
