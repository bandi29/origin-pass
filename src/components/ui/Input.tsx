"use client"

import type { InputHTMLAttributes } from "react"
import clsx from "clsx"

type Props = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: Props) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 placeholder:text-muted focus:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary/30",
        className
      )}
    />
  )
}
