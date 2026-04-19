"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import { ChevronDown, Menu, X } from "lucide-react"

type NavItem = {
    label: string
    href: string
    children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard" },
    {
        label: "Products",
        href: "/dashboard/products",
        children: [{ href: "/product/passports", label: "Passports" }],
    },
    {
        label: "Authenticity",
        href: "/dashboard/authenticity",
        children: [
            { href: "/dashboard/authenticity/rules", label: "Verification rules" },
            { href: "/dashboard/authenticity/alerts", label: "Counterfeit alerts" },
            { href: "/dashboard/authenticity/analytics", label: "Fraud analytics" },
            { href: "/dashboard/authenticity/map", label: "Global map" },
            { href: "/dashboard/authenticity/audit", label: "Audit logs" },
        ],
    },
    {
        label: "QR Identity",
        href: "/product/qr-identity",
        children: [
            { href: "/product/qr-identity/generate", label: "Generate codes" },
            { href: "/product/qr-identity/batch", label: "Batch export" },
            { href: "/product/qr-identity/print", label: "Print labels" },
        ],
    },
    {
        label: "Ownership",
        href: "/product/ownership",
        children: [
            { href: "/product/ownership/records", label: "Ownership records" },
            { href: "/product/ownership/warranty", label: "Warranty lifecycle" },
        ],
    },
    {
        label: "Analytics",
        href: "/analytics",
        children: [
            { href: "/analytics/scans", label: "Scan analytics" },
            { href: "/analytics/locations", label: "Geographic insights" },
            { href: "/analytics/fraud", label: "Fraud detection" },
        ],
    },
    { label: "Integrations", href: "/integrations" },
    { label: "Settings", href: "/settings" },
]

function isPathActive(pathname: string | null, href: string) {
    if (!pathname) return false
    const noLocale = pathname.replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"
    if (href === "/") return noLocale === "/"
    return noLocale === href || noLocale.startsWith(`${href}/`)
}

function DesktopDropdown({ item, pathname }: { item: NavItem; pathname: string | null }) {
    const active = isPathActive(pathname, item.href) || item.children?.some((c) => isPathActive(pathname, c.href))
    return (
        <div className="relative hidden lg:block group">
            <Link
                href={item.href}
                className={`inline-flex items-center gap-1 transition-colors ${
                    active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"
                }`}
            >
                {item.label}
                {item.children ? (
                    <ChevronDown className={`w-3.5 h-3.5 transition-colors ${active ? "text-slate-700" : "text-slate-400 group-hover:text-slate-700"}`} />
                ) : null}
            </Link>
            {item.children ? (
                <div className="absolute left-0 top-full z-50 pt-3 opacity-0 -translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto transition-all duration-150">
                    <div className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-xl">
                        {item.children.map((child) => {
                            const childActive = isPathActive(pathname, child.href)
                            return (
                                <Link
                                    key={child.href}
                                    href={child.href}
                                    className={`block whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                        childActive
                                            ? "bg-slate-900 text-white"
                                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                                >
                                    {child.label}
                                </Link>
                            )
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default function MainNav() {
    const pathname = usePathname()
    const { user, loading } = useSupabaseUser()
    const [mobileOpen, setMobileOpen] = useState(false)

    if (loading) {
        return (
            <>
                <nav className="hidden items-center gap-6 lg:flex" aria-hidden>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-4 w-14 animate-pulse rounded bg-slate-100" />
                    ))}
                </nav>
                <div
                    className="inline-flex h-9 w-9 animate-pulse rounded-lg border border-transparent bg-slate-100 lg:hidden"
                    aria-hidden
                />
            </>
        )
    }

    if (!user) {
        return null
    }

    return (
        <>
            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
                {navItems.map((item) => (
                    <DesktopDropdown key={item.href} item={item} pathname={pathname} />
                ))}
            </nav>

            <button
                type="button"
                onClick={() => setMobileOpen((s) => !s)}
                className="lg:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileOpen}
            >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {mobileOpen ? (
                <div className="absolute left-0 right-0 top-16 z-50 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
                    <div className="mx-auto w-full max-w-[1220px] px-5 py-4 space-y-3">
                        {navItems.map((item) => {
                            const active = isPathActive(pathname, item.href)
                            return (
                                <div key={item.href} className="space-y-2">
                                    <Link
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                                            active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        {item.label}
                                    </Link>
                                    {item.children ? (
                                        <div className="pl-3 space-y-1">
                                            {item.children.map((child) => (
                                                <Link
                                                    key={child.href}
                                                    href={child.href}
                                                    onClick={() => setMobileOpen(false)}
                                                    className={`block rounded-lg px-3 py-1.5 text-sm ${
                                                        isPathActive(pathname, child.href)
                                                            ? "bg-slate-100 text-slate-900"
                                                            : "text-slate-600 hover:bg-slate-50"
                                                    }`}
                                                >
                                                    {child.label}
                                                </Link>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : null}
        </>
    )
}
