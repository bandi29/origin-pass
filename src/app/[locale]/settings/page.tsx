import type { ReactNode } from "react"
import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { ArrowRight, CreditCard, Shield, User, Users } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { IconChip, type IconChipTone } from "@/components/ui/IconChip"

type SettingsTile = {
  href: string
  title: string
  description: string
  icon: ReactNode
  tone: IconChipTone
}

const tiles: SettingsTile[] = [
  {
    href: "/settings/account",
    title: "Account",
    description: "Profile and preferences",
    icon: <User />,
    tone: "indigo",
  },
  {
    href: "/dashboard/team",
    title: "Team",
    description: "Members, roles, and invitations",
    icon: <Users />,
    tone: "violet",
  },
  {
    href: "/settings/billing",
    title: "Billing",
    description: "Subscription and payment method",
    icon: <CreditCard />,
    tone: "emerald",
  },
  {
    href: "/settings/security",
    title: "Security",
    description: "Sessions, MFA, and audit logs",
    icon: <Shield />,
    tone: "navy",
  },
]

export default function SettingsPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader title="Settings" description="Manage your account and organization." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          // Tiles render through `<Card interactive>` so radius, border, shadow,
          // and hover-lift come from one place. The trailing arrow gives a
          // subtle affordance that wasn't present in the previous flat tiles.
          <Link key={tile.href} href={tile.href} className="group block no-underline">
            <Card interactive padding className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <IconChip tone={tile.tone} size="lg">
                  {tile.icon}
                </IconChip>
                <ArrowRight className="h-4 w-4 translate-x-0 text-slate-300 transition-all duration-200 ease-smooth group-hover:translate-x-1 group-hover:text-slate-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">{tile.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{tile.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </FadeIn>
  )
}
