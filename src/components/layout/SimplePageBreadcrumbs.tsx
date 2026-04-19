"use client"

import clsx from "clsx"
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/Breadcrumb"

export type BreadcrumbEntry = { label: string; href?: string }

export function SimplePageBreadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbEntry[]
  className?: string
}) {
  if (!items.length) return null
  return (
    <Breadcrumb className={clsx("mb-0", className)}>
      {items.map((item, i) => (
        <BreadcrumbItem key={`${item.label}-${i}`} href={item.href}>
          {item.label}
        </BreadcrumbItem>
      ))}
    </Breadcrumb>
  )
}
