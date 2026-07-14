"use client"

import { Children, Fragment, isValidElement, useId, useMemo, type ComponentProps, type ReactNode } from "react"
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from "@headlessui/react"
import { Check, ChevronDown } from "lucide-react"
import clsx from "clsx"

/**
 * Shared trigger styling. Kept as an export for legacy callers that style
 * native selects directly. New code should use <StudioNativeSelect>.
 */
export const STUDIO_SELECT_TRIGGER =
  "box-border h-10 min-h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-4 py-2 pr-10 text-sm font-medium leading-normal text-slate-900 shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

type SelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
}

function flattenChildrenToOptions(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    // Recurse through fragments / arrays
    if (child.type === Fragment) {
      const props = child.props as { children?: ReactNode }
      out.push(...flattenChildrenToOptions(props.children))
      return
    }
    if (child.type === "option") {
      const props = child.props as {
        value?: string | number | readonly string[]
        children?: ReactNode
        disabled?: boolean
        label?: string
      }
      const rawValue = props.value
      const value = rawValue == null ? "" : String(rawValue)
      const label: ReactNode = props.children ?? props.label ?? value
      out.push({ value, label, disabled: Boolean(props.disabled) })
    }
    // <optgroup> not supported — flatten its options instead
    if (child.type === "optgroup") {
      const props = child.props as { children?: ReactNode }
      out.push(...flattenChildrenToOptions(props.children))
    }
  })
  return out
}

/**
 * Premium-styled select that mirrors the API of a native `<select>` element so it
 * is a drop-in replacement for legacy call sites. Children may be plain `<option>`
 * elements; values are read from `option.value` and labels from `option.children`.
 *
 * The open menu is a Headless UI Listbox rendered as a styled popover so we can
 * fully control hover/selection visuals — unlike a native dropdown whose open
 * state is painted by the OS.
 */
export function StudioNativeSelect({
  className,
  wrapClassName,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  required,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ComponentProps<"select"> & { wrapClassName?: string }) {
  const reactId = useId()
  const triggerId = id ?? `studio-select-${reactId}`

  const options = useMemo(() => flattenChildrenToOptions(children), [children])
  const currentValue =
    value != null ? String(value) : defaultValue != null ? String(defaultValue) : (options[0]?.value ?? "")
  const selected = options.find((o) => o.value === currentValue) ?? options[0]

  const emit = (nextValue: string) => {
    if (!onChange) return
    // Synthesize a minimal change event so existing callers using e.target.value keep working.
    const synthetic = {
      target: { value: nextValue, name: name ?? "" },
      currentTarget: { value: nextValue, name: name ?? "" },
    } as unknown as React.ChangeEvent<HTMLSelectElement>
    onChange(synthetic)
  }

  return (
    <div className={clsx("relative h-10 w-full min-w-0", wrapClassName)}>
      {/* Hidden native input so the value is included in form submissions when `name` is set. */}
      {name ? <input type="hidden" name={name} value={currentValue} required={required} /> : null}

      <Listbox value={currentValue} onChange={emit} disabled={disabled}>
        <ListboxButton
          id={triggerId}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={clsx(
            STUDIO_SELECT_TRIGGER,
            "flex items-center text-left",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          <span className="block flex-1 truncate">{selected?.label ?? ""}</span>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </ListboxButton>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="opacity-0 -translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 -translate-y-1"
        >
          <ListboxOptions
            anchor={{ to: "bottom start", gap: 6 }}
            className={clsx(
              "z-50 max-h-72 w-[var(--button-width)] min-w-[12rem] overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5 focus:outline-none",
            )}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">No options</div>
            ) : (
              options.map((opt) => (
                <ListboxOption
                  key={`${opt.value}-${typeof opt.label === "string" ? opt.label : ""}`}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={({ focus, selected: isSelected, disabled: isDisabled }) =>
                    clsx(
                      "group relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 pr-9 text-sm leading-normal transition-colors",
                      isDisabled && "cursor-not-allowed opacity-50",
                      !isDisabled && focus && "bg-slate-100 text-slate-900",
                      !focus && !isSelected && "text-slate-700",
                      isSelected && "bg-brand/5 font-semibold text-brand",
                    )
                  }
                >
                  {({ selected: isSelected }) => (
                    <>
                      <span className="block flex-1 truncate">{opt.label}</span>
                      {isSelected ? (
                        <span className="pointer-events-none absolute right-2.5 flex h-5 w-5 items-center justify-center text-brand">
                          <Check className="h-4 w-4" aria-hidden />
                        </span>
                      ) : null}
                    </>
                  )}
                </ListboxOption>
              ))
            )}
          </ListboxOptions>
        </Transition>
      </Listbox>
    </div>
  )
}
