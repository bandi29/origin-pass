"use client"

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"
import { Link } from "@/i18n/navigation"
import { safePrimarySurfaceStyle } from "@/lib/safe-cta-surface"
import { twMerge } from "tailwind-merge"

const variants = {
  /**
   * `!` utilities so background/text win over preflight `a{color:inherit}` and
   * any layer ordering; single-node links avoid nested span quirks.
   */
  primary:
    "!border !border-transparent !bg-primary !text-white shadow-sm hover:!bg-[#1e293b] hover:shadow-md focus-visible:ring-2 focus-visible:ring-secondary/40 [&_svg]:!text-white",
  secondary:
    "border border-border bg-white text-gray-700 shadow-sm hover:bg-canvas hover:shadow-md focus-visible:ring-2 focus-visible:ring-secondary/30",
  outline:
    "border border-border bg-white text-gray-700 hover:bg-canvas focus-visible:ring-2 focus-visible:ring-secondary/30",
  ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-300/30",
  danger:
    "!border !border-transparent !bg-danger !text-white shadow-sm hover:!bg-[#b91c1c] hover:shadow-md focus-visible:ring-2 focus-visible:ring-red-400/50 [&_svg]:!text-white",
} as const

const sizes = {
  sm: "rounded-xl px-4 py-2 text-xs font-medium",
  md: "rounded-xl px-6 py-3 text-sm font-medium",
  lg: "rounded-xl px-6 py-3 text-sm font-medium",
} as const

export type ButtonVariant = keyof typeof variants
export type ButtonSize = keyof typeof sizes

type BaseProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

type ButtonLinkProps = BaseProps & {
  href: string
  external?: boolean
}

type ButtonNativeProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: never
    external?: never
  }

export type ButtonProps = ButtonLinkProps | ButtonNativeProps

function linkMinimalStyle(variant: ButtonVariant): CSSProperties | undefined {
  if (variant === "primary") {
    return safePrimarySurfaceStyle()
  }
  if (variant === "danger") {
    return {
      backgroundColor: "#dc2626",
      color: "#ffffff",
      WebkitTextFillColor: "#ffffff",
    }
  }
  return undefined
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children } = props

  const linkLayout =
    "inline-flex w-full min-w-0 max-w-full appearance-none items-center justify-center gap-2 rounded-xl no-underline transition-all duration-200 ease-smooth active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-offset-2 sm:w-auto"

  const classes = twMerge(
    "inline-flex appearance-none items-center justify-center gap-2 transition-all duration-200 ease-smooth active:scale-95 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className
  )

  const linkClasses = twMerge(linkLayout, variants[variant], sizes[size], className)

  if ("href" in props && props.href) {
    const minimal = linkMinimalStyle(variant)

    if (props.external) {
      return (
        <a
          href={props.href}
          className={linkClasses}
          style={minimal}
          rel="noopener noreferrer"
          target="_blank"
        >
          {children}
        </a>
      )
    }
    return (
      <Link href={props.href} className={linkClasses} style={minimal}>
        {children}
      </Link>
    )
  }

  const { type = "button", ...btn } = props as ButtonNativeProps
  const nativeStyle = linkMinimalStyle(variant)
  return (
    <button type={type} className={classes} style={nativeStyle} {...btn}>
      {children}
    </button>
  )
}
