"use client"

import { Info } from "lucide-react"

interface InfoTooltipProps {
    text: string
    className?: string
}

export default function InfoTooltip({ text, className = "" }: InfoTooltipProps) {
    return (
        <span
            className={`inline-flex items-center text-slate-400 hover:text-slate-600 cursor-help ${className}`}
            title={text}
        >
            <Info className="w-3.5 h-3.5" />
        </span>
    )
}
