import { Link } from "@/i18n/navigation"
import { ArrowRight, type LucideIcon } from "lucide-react"

type ProductModuleCardProps = {
  href: string
  icon: LucideIcon
  title: string
  description: string
}

export function ProductModuleCard({ href, icon: Icon, title, description }: ProductModuleCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors duration-200 group-hover:bg-slate-900 group-hover:text-white">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors group-hover:text-slate-900">
        Learn more
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}
