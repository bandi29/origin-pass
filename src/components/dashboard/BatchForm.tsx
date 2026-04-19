'use client'

import { useState, useRef, useEffect } from 'react'
import { createBatchAndCodes, type CreateBatchResult } from "@/actions/generate-codes"
import { Loader2, Download, Package, User, MapPin, Calendar, Printer, Eye, X, CheckCircle2, Plus, Trash2, Layers, Recycle, Building2 } from "lucide-react"
import { useReactToPrint } from 'react-to-print'
import { PrintLabels } from './PrintLabels'
import { QRCodeSVG } from 'qrcode.react'
import InfoTooltip from "@/components/ui/InfoTooltip"
import { validateMaterialComposition, type MaterialEntry } from "@/lib/material-validation"
import { clearDraft as clearProductDraft } from "@/lib/product-form-draft"

const END_OF_LIFE_OPTIONS = [
    { value: "biodegradable", label: "Biodegradable" },
    { value: "return_to_studio", label: "Return to Studio for Recycling" },
    { value: "textile_recycling_bin", label: "Textile Recycling Bin" },
    { value: "other", label: "Other (specify below)" },
] as const

interface BatchFormProps {
    products: { id: string; name: string; origin?: string | null; materials?: string | null }[]
    initialProductId?: string
}

export default function BatchForm({ products, initialProductId }: BatchFormProps) {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<CreateBatchResult | null>(null)
    const [quantity, setQuantity] = useState(10)
    const [showPreview, setShowPreview] = useState(false)
    const [step, setStep] = useState(1)
    const [productId, setProductId] = useState(initialProductId ?? '')

    useEffect(() => {
        if (initialProductId && products.some((p) => p.id === initialProductId)) {
            setProductId(initialProductId)
        }
    }, [initialProductId, products])
    const [productionRunName, setProductionRunName] = useState('')
    const [artisanName, setArtisanName] = useState('')
    const [location, setLocation] = useState('')
    const [producedAt, setProducedAt] = useState('')

    // EU DPP fields
    const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([{ material: "", percentage: 0 }])
    const [maintenanceInstructions, setMaintenanceInstructions] = useState('')
    const [endOfLifeOption, setEndOfLifeOption] = useState<string>('')
    const [endOfLifeOther, setEndOfLifeOther] = useState('')
    const [facilityInfo, setFacilityInfo] = useState('')
    const materialValidation = validateMaterialComposition(materialEntries)

    const step1BlockingReasons: string[] = []
    if (!productId) step1BlockingReasons.push("Select a product")
    if (quantity < 1) step1BlockingReasons.push("Enter a quantity of at least 1")

    const step2BlockingReasons: string[] = []
    if (!productionRunName.trim()) step2BlockingReasons.push("Add a run name / ID")
    if (!artisanName.trim()) step2BlockingReasons.push("Add artisan or workshop name")
    if (!location.trim()) step2BlockingReasons.push("Add production location")
    if (!producedAt) step2BlockingReasons.push("Select production date")
    if (!materialValidation.valid) step2BlockingReasons.push(materialValidation.error || "Complete material composition to total 100%")
    if (!maintenanceInstructions.trim()) step2BlockingReasons.push("Add maintenance/care instructions")
    if (!endOfLifeOption) step2BlockingReasons.push("Select end-of-life option")
    if (endOfLifeOption === "other" && !endOfLifeOther.trim()) {
        step2BlockingReasons.push("Specify end-of-life instructions")
    }

    const nextDisabled =
        (step === 1 && step1BlockingReasons.length > 0) ||
        (step === 2 && step2BlockingReasons.length > 0)
    const currentBlockingReasons = step === 1 ? step1BlockingReasons : step2BlockingReasons

    // Print Hook
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef: printRef, // Use contentRef for react-to-print v3+ (checking types compatibility)
        // If contentRef is not supported in the installed version, fallback to content: () => printRef.current
    })

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)

        const materialComposition = materialEntries
            .filter((e) => e.material?.trim())
            .map((e) => ({ material: e.material.trim(), percentage: e.percentage }))

        const endOfLife = endOfLifeOption === "other" ? endOfLifeOther : END_OF_LIFE_OPTIONS.find((o) => o.value === endOfLifeOption)?.label ?? endOfLifeOption

        const batchDetails = {
            productionRunName,
            artisanName,
            location,
            producedAt,
            materialComposition,
            maintenanceInstructions: maintenanceInstructions.trim() || null,
            endOfLifeInstructions: endOfLife?.trim() || null,
            facilityInfo: facilityInfo.trim() || null,
        }

        try {
            const res = await createBatchAndCodes(productId, batchDetails, quantity)
            if (res.success) {
                clearProductDraft()
            }
            setResult(res)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    if (result?.success) {
        const sampleCode = result.codes?.[0]?.serialId
        return (
            <div className="p-8 bg-green-50 text-green-900 rounded-xl border border-green-100 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold">Production Batch Created Successfully</h3>
                <p className="max-w-md mx-auto text-sm text-green-800">
                    {result.codes?.length ?? 0} unique Digital Product Passports have been generated.
                </p>
                <div className="text-xs text-green-600 font-medium bg-green-100/50 py-1 px-3 rounded-full inline-block">
                    Usage recorded for billing
                </div>

                {sampleCode && (
                    <div className="rounded-xl border border-green-100 bg-white/70 px-4 py-3 text-xs text-green-800">
                        Sample Passport: <span className="font-mono">{sampleCode}</span>
                    </div>
                )}

                <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                    {/* Print Button */}
                    <button
                        onClick={() => handlePrint()}
                        className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition gap-2 shadow-lg"
                    >
                        <Printer className="w-4 h-4" />
                        Print Labels
                    </button>

                    {/* Preview Button */}
                    <button
                        onClick={() => setShowPreview(true)}
                        className="inline-flex items-center px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition gap-2 shadow-sm"
                    >
                        <Eye className="w-4 h-4" />
                        Preview
                    </button>

                    {sampleCode && (
                        <a
                            href={`/verify/${sampleCode}`}
                            className="inline-flex items-center px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition gap-2 shadow-sm"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            View Passport
                        </a>
                    )}

                    {/* Placeholder for ZIP Download */}
                    <button className="inline-flex items-center px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition gap-2 shadow-sm">
                        <Download className="w-4 h-4" />
                        Download ZIP
                    </button>

                    {/* Hidden Printable Component (Source of Truth) */}
                    <div className="hidden">
                        <PrintLabels
                            ref={printRef}
                            codes={result.codes ?? []}
                            baseUrl={typeof window !== 'undefined' ? window.location.origin : 'https://originpass.com'}
                        />
                    </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-400">
                    Use standard A4 or Letter sticker paper. (3 Columns)
                </div>

                <button onClick={() => setResult(null)} className="block w-full text-sm text-green-700 hover:text-green-800 underline pt-4">
                    Create Another Batch
                </button>

                {/* Print Preview Modal */}
                {showPreview && (
                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Printer className="w-4 h-4 text-slate-500" /> Print Preview
                                </h3>
                                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                                <div className="bg-white shadow-sm ring-1 ring-slate-200 min-h-[11in] mx-auto max-w-[8.5in] p-[10mm]">
                                    <PrintLabels
                                        codes={result.codes ?? []}
                                        baseUrl={typeof window !== 'undefined' ? window.location.origin : 'https://originpass.com'}
                                        className="!block"
                                    />
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-white">
                                <button onClick={() => setShowPreview(false)} className="px-4 py-2 text-slate-600 font-medium text-sm hover:text-slate-900">Close</button>
                                <button onClick={() => { handlePrint(); setShowPreview(false); }} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2">
                                    <Printer className="w-4 h-4" /> Print Now
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Step {step} of 3</span>
                <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-amber-500' : 'bg-slate-200'}`} />
                    <span className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-amber-500' : 'bg-slate-200'}`} />
                    <span className={`h-2 w-2 rounded-full ${step >= 3 ? 'bg-amber-500' : 'bg-slate-200'}`} />
                </div>
            </div>
            <p className="text-xs text-slate-500">
                <span className="text-rose-500">*</span> Required fields
            </p>

            {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Select Product <span className="text-rose-500">*</span>
                        </label>
                        <select
                            name="productId"
                            required
                            value={productId}
                            onChange={(event) => setProductId(event.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                        >
                            <option value="">-- Choose Product --</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}{p.origin || p.materials ? ` — ${[p.origin, p.materials].filter(Boolean).join(' • ')}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Quantity to Generate <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="quantity"
                            value={quantity}
                            min={1}
                            max={100}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                        <div className="flex justify-between items-start">
                            <p className="text-xs text-slate-500">
                                This will generate {quantity} passports and use {quantity} credits.
                            </p>
                            <p className="text-xs font-medium text-slate-700">
                                Estimated Total: <span className="text-slate-900">${(quantity * 0.10).toFixed(2)}</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        Batch Details
                    </h3>

                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-gray-500">
                            Run Name / ID <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="productionRunName"
                            placeholder="e.g. Summer Collection 2026 - A"
                            required
                            value={productionRunName}
                            onChange={(event) => setProductionRunName(event.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none"
                        />
                        <p className="text-[11px] text-slate-400">Internal reference (not shown to customers)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <User className="w-3 h-3" /> Artisan <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="artisanName"
                                placeholder="Master Artisan Name"
                                required
                                value={artisanName}
                                onChange={(event) => setArtisanName(event.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none"
                            />
                            <p className="text-[10px] text-slate-400">Individual or workshop name</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Location <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="location"
                                placeholder="City, Country"
                                required
                                value={location}
                                onChange={(event) => setLocation(event.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none"
                            />
                            <p className="text-[10px] text-slate-400">City, Country (shown publicly)</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                name="producedAt"
                                required
                                value={producedAt}
                                onChange={(event) => setProducedAt(event.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none"
                            />
                        </div>
                    </div>

                    {/* Material Composition (EU DPP) */}
                    <div className="pt-6 border-t border-gray-200 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-slate-500" />
                            Material Composition
                            <span className="text-rose-500">*</span>
                            <InfoTooltip text="Required for EU ESPR 2026 Compliance. Percentages must total 100%." />
                        </h4>
                        {materialEntries.map((entry, idx) => (
                            <div key={idx} className="flex gap-2 items-start">
                                <input
                                    type="text"
                                    placeholder="e.g. Organic Cotton"
                                    value={entry.material}
                                    onChange={(e) => {
                                        const next = [...materialEntries]
                                        next[idx] = { ...next[idx], material: e.target.value }
                                        setMaterialEntries(next)
                                    }}
                                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-900"
                                />
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="%"
                                    value={entry.percentage || ""}
                                    onChange={(e) => {
                                        const next = [...materialEntries]
                                        next[idx] = { ...next[idx], percentage: parseInt(e.target.value) || 0 }
                                        setMaterialEntries(next)
                                    }}
                                    className="w-20 px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-900"
                                />
                                <button
                                    type="button"
                                    onClick={() => setMaterialEntries((prev) => prev.filter((_, i) => i !== idx))}
                                    disabled={materialEntries.length <= 1}
                                    className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-40"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setMaterialEntries((prev) => [...prev, { material: "", percentage: 0 }])}
                            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                        >
                            <Plus className="w-4 h-4" /> Add material
                        </button>
                        {(() => {
                            return materialValidation.valid ? (
                                <p className="text-xs text-emerald-600">Total: 100% ✓</p>
                            ) : (
                                <p className="text-xs text-amber-600">{materialValidation.error}</p>
                            )
                        })()}
                    </div>

                    {/* Circularity & Care Instructions */}
                    <div className="pt-6 border-t border-gray-200 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <Recycle className="w-4 h-4 text-slate-500" />
                            Circularity & Care Instructions
                            <InfoTooltip text="Required for EU ESPR 2026 Compliance. Helps customers extend product lifespan and dispose responsibly." />
                        </h4>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500">
                                Maintenance (How to clean and repair) <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                placeholder="e.g. Hand wash cold. Air dry. Minor repairs can be done at our studio."
                                value={maintenanceInstructions}
                                onChange={(e) => setMaintenanceInstructions(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-900 resize-y"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500">
                                End-of-Life (Disposal / Recycling) <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={endOfLifeOption}
                                onChange={(e) => setEndOfLifeOption(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-900"
                            >
                                <option value="">-- Select option --</option>
                                {END_OF_LIFE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            {endOfLifeOption === "other" && (
                                <input
                                    type="text"
                                    placeholder="Specify disposal instructions"
                                    value={endOfLifeOther}
                                    onChange={(e) => setEndOfLifeOther(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-900"
                                />
                            )}
                        </div>
                    </div>

                    {/* Traceability: Facility Info */}
                    <div className="pt-6 border-t border-gray-200 space-y-2">
                        <label className="text-xs font-medium text-gray-500 flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5" />
                            Facility Info (Workshop / Factory Address)
                            <InfoTooltip text="Required for EU ESPR 2026 Compliance. Where final assembly happened, if different from brand location." />
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Via Roma 12, 50123 Florence, Italy"
                            value={facilityInfo}
                            onChange={(e) => setFacilityInfo(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-900"
                        />
                        <p className="text-[10px] text-slate-400">Leave blank if same as brand location</p>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
                        <div className="text-xs uppercase tracking-widest text-slate-400">Passport Preview</div>
                        <div className="aspect-[4/3] rounded-xl bg-slate-50 flex items-center justify-center">
                            <QRCodeSVG value="OP-Preview" size={120} level="M" />
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                            <div className="font-semibold text-slate-900">{products.find(p => p.id === productId)?.name || 'Product Name'}</div>
                            <div>Crafted by: {artisanName || 'Artisan Name'}</div>
                            <div>Made in: {location || 'City, Country'}</div>
                            <div>Produced on: {producedAt || 'Date'}</div>
                        </div>
                    </div>
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 text-sm text-slate-600">
                        <div className="text-xs uppercase tracking-widest text-slate-400">Review</div>
                        <div>Quantity: <span className="font-medium text-slate-900">{quantity}</span></div>
                        <div>Run Name: <span className="font-medium text-slate-900">{productionRunName || '—'}</span></div>
                        <div>Materials: <span className="font-medium text-slate-900">{materialEntries.filter(e => e.material?.trim()).map(e => `${e.material} ${e.percentage}%`).join(', ') || '—'}</span></div>
                        <div>End-of-Life: <span className="font-medium text-slate-900">{endOfLifeOption === 'other' ? endOfLifeOther : END_OF_LIFE_OPTIONS.find(o => o.value === endOfLifeOption)?.label || '—'}</span></div>
                        <div>Estimated total: <span className="font-medium text-slate-900">${(quantity * 0.10).toFixed(2)}</span></div>
                        <p className="text-xs text-slate-400">You can edit details before generating passports.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <button
                    type="button"
                    onClick={() => setStep(Math.max(1, step - 1))}
                    disabled={step === 1 || loading}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition disabled:opacity-50"
                >
                    Back
                </button>

                {step < 3 ? (
                    <button
                        type="button"
                        onClick={() => setStep(step + 1)}
                        disabled={nextDisabled}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-70"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-70 flex items-center gap-2 justify-center"
                    >
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : null}
                        Generate Passports
                    </button>
                )}
            </div>

            {step < 3 && nextDisabled && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">Complete these to continue:</p>
                    <div className="mt-1 space-y-0.5 text-amber-800">
                        {currentBlockingReasons.map((reason) => (
                            <p key={reason}>• {reason}</p>
                        ))}
                    </div>
                </div>
            )}

            {result?.error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                    {result.error}
                </div>
            )}
        </form>
    )
}
