"use client"

import { useRef } from "react"
import clsx from "clsx"
import { AlertCircle, Check } from "lucide-react"
import type { LabelStudioStepId } from "@/components/dashboard/qr-identity/label-studio/types"
import type { StudioProgressStep } from "@/components/dashboard/qr-identity/label-studio/use-studio-progress"
import {
  STUDIO_BORDER,
  STUDIO_INK,
  STUDIO_SURFACE,
  STUDIO_WARN,
} from "@/components/dashboard/qr-identity/label-studio/constants"

function stepAriaLabel(step: StudioProgressStep): string {
  const prefix = `Step ${step.index}, ${step.label},`
  if (step.status === "done") return `${prefix} completed`
  if (step.status === "blocked") {
    return `${prefix} needs attention${step.reason ? `: ${step.reason}` : ""}`
  }
  if (step.isCurrent) return `${prefix} in progress`
  return `${prefix} not started`
}

function StepNode({ step }: { step: StudioProgressStep }) {
  const ringClass = step.isCurrent
    ? "ring-2 ring-[#356B4E]/25 ring-offset-1 ring-offset-[#FCFBF8]"
    : ""

  if (step.status === "done") {
    return (
      <span
        className={clsx(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#356B4E] text-white shadow-sm transition-colors duration-300",
          ringClass,
        )}
        aria-hidden
      >
        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
      </span>
    )
  }

  if (step.status === "blocked") {
    return (
      <span className={clsx("relative grid h-7 w-7 shrink-0 place-items-center", ringClass)} aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B9722B]/35 motion-reduce:animate-none" />
        <span
          className="relative grid h-7 w-7 place-items-center rounded-full border-2 bg-[#FBEEDD] text-[#B9722B]"
          style={{ borderColor: STUDIO_WARN }}
        >
          <AlertCircle className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden />
        </span>
      </span>
    )
  }

  return (
    <span
      className={clsx(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#D8D3C7] bg-[#F1EEE7] text-xs font-semibold text-[#9AA0A8] transition-colors duration-300",
        ringClass,
      )}
      aria-hidden
    >
      {step.index}
    </span>
  )
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <span
      className={clsx(
        "mx-1 hidden h-0.5 min-w-[1.25rem] flex-1 rounded-full transition-colors duration-500 sm:block",
        filled ? "bg-[#356B4E]/55" : "bg-[#E7E2D7]",
      )}
      aria-hidden
    />
  )
}

export function LabelStudioProgressRail({
  steps,
  readyCount,
  totalSteps,
  onStepSelect,
}: {
  steps: StudioProgressStep[]
  readyCount: number
  totalSteps: number
  onStepSelect: (id: LabelStudioStepId, trigger?: HTMLElement | null) => void
}) {
  const stepRefs = useRef<Partial<Record<LabelStudioStepId, HTMLButtonElement | null>>>({})

  const focusStep = (id: LabelStudioStepId) => {
    onStepSelect(id, stepRefs.current[id] ?? null)
    requestAnimationFrame(() => stepRefs.current[id]?.focus())
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    let next = index
    if (e.key === "ArrowRight") next = (index + 1) % steps.length
    else if (e.key === "ArrowLeft") next = (index - 1 + steps.length) % steps.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = steps.length - 1
    focusStep(steps[next].key)
  }

  return (
    <nav
      className="border-b px-3 py-2 sm:px-5"
      style={{ borderColor: STUDIO_BORDER, backgroundColor: STUDIO_SURFACE }}
      aria-label="Label studio workflow"
    >
      <div className="mb-1 flex justify-end sm:justify-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9AA0A8] sm:text-[11px]">
          {readyCount} of {totalSteps} ready
        </p>
      </div>
      <ol className="flex items-start gap-0" role="list">
        {steps.map((step, i) => {
          const connectorFilled = step.status === "done"

          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-center" role="listitem">
              <button
                type="button"
                ref={(el) => {
                  stepRefs.current[step.key] = el
                }}
                onClick={(e) => onStepSelect(step.key, e.currentTarget)}
                onKeyDown={(e) => onKeyDown(e, i)}
                tabIndex={step.isCurrent ? 0 : -1}
                className={clsx(
                  "group flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-0.5 leading-tight transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]",
                  step.isCurrent ? "text-[#0E1B2A]" : "text-[#6B7079] hover:text-[#15293E]",
                )}
                aria-current={step.isCurrent ? "step" : undefined}
                aria-label={stepAriaLabel(step)}
              >
                <StepNode step={step} />
                <span
                  className={clsx(
                    "max-w-full truncate text-center text-[11px] tracking-wide sm:text-xs",
                    step.isCurrent ? "font-bold" : "font-semibold",
                  )}
                  style={{ color: step.isCurrent ? STUDIO_INK : undefined }}
                >
                  {step.label}
                </span>
                <span
                  className={clsx(
                    "max-w-full truncate text-center text-[10px] leading-tight sm:text-[11px]",
                    step.status === "blocked"
                      ? "font-medium text-[#B9722B]"
                      : step.status === "done"
                        ? "text-[#356B4E]"
                        : step.isCurrent
                          ? "font-medium text-[#15293E]"
                          : "text-[#9AA0A8]",
                  )}
                  style={step.status === "blocked" ? { color: STUDIO_WARN } : undefined}
                >
                  {step.subtext}
                </span>
              </button>
              {i < steps.length - 1 ? <Connector filled={connectorFilled} /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
