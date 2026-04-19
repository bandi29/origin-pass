import type { ReactNode } from "react"
import clsx from "clsx"
import { twMerge } from "tailwind-merge"

type Props = {
  title: ReactNode
  description?: ReactNode
  className?: string
  titleClassName?: string
  as?: "h1" | "h2"
  variant?: "default" | "marketing"
}

export function SectionHeader({
  title,
  description,
  className,
  titleClassName,
  as = "h2",
  variant = "default",
}: Props) {
  const Heading = as
  const marketing = variant === "marketing"
  return (
    <div
      className={twMerge(
        clsx(
          "mx-auto max-w-2xl text-center",
          marketing ? "flex flex-col items-center gap-5 md:gap-6" : "mb-14 md:mb-16",
          className
        )
      )}
    >
      <Heading
        className={twMerge(
          marketing
            ? "text-3xl font-semibold tracking-tight text-gray-900 md:text-[30px] md:leading-[38px]"
            : "text-3xl font-semibold tracking-tight text-primary",
          !marketing && as === "h1" && "text-4xl",
          titleClassName
        )}
      >
        {title}
      </Heading>
      {description ? (
        <div
          className={clsx(
            marketing ? "flex flex-col gap-0" : "mt-3 space-y-2",
            !marketing && "text-muted"
          )}
        >
          {typeof description === "string" ? (
            marketing ? (
              <p className="max-w-2xl mx-auto text-center text-[16px] leading-[26px] text-gray-600">
                {description}
              </p>
            ) : (
              <p>{description}</p>
            )
          ) : (
            description
          )}
        </div>
      ) : null}
    </div>
  )
}
