import type { ReactNode } from "react"
import { twMerge } from "tailwind-merge"
import { Container } from "@/components/ui/Container"

type ContainerProps = {
  children: ReactNode
  className?: string
}

export function NarrowContainer({ children, className = "" }: ContainerProps) {
  return <Container className={twMerge(className)}>{children}</Container>
}

export function WideContainer({ children, className = "" }: ContainerProps) {
  return (
    <div
      className={twMerge(
        "mx-auto max-w-[1720px] px-6",
        className
      )}
    >
      {children}
    </div>
  )
}
