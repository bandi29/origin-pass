import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { ShieldCheck, ArrowRight, Globe } from "lucide-react"

export default function CompliancePage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Compliance</h1>
                <p className="text-slate-500 mt-2">Regional compliance standards and Digital Product Passport alignment</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Link href="/dashboard/compliance/eu" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition group">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <ShieldCheck className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">EU Digital Product Passport</h3>
                            <p className="text-xs text-slate-500">European Union</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                        Get ready for EU DPP requirements with structured product data and traceability.
                    </p>
                    <div className="inline-flex items-center gap-1 text-sm text-blue-600 group-hover:gap-2 transition-all">
                        View Details <ArrowRight className="w-4 h-4" />
                    </div>
                </Link>

                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 opacity-50">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Globe className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-700">Other Regions</h3>
                            <p className="text-xs text-slate-400">Coming Soon</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                        Support for additional regional compliance standards will be added in future updates.
                    </p>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Need help with compliance?</h3>
                <p className="text-sm text-blue-800 mb-4">
                    Our team can help you understand how to structure your product data to meet regulatory requirements.
                </p>
                <Link href="/support" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
                    Contact Support <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    )
}
