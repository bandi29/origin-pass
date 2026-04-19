"use client"

import { useRouter } from "next/navigation"

type BackButtonProps = {
    fallbackHref?: string
    className?: string
    label?: string
}

export default function BackButton({
    fallbackHref = "/",
    className = "",
    label = "Back",
}: BackButtonProps) {
    const router = useRouter()

    return (
        <button
            type="button"
            onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                    router.back()
                    return
                }
                router.push(fallbackHref)
            }}
            className={className}
        >
            {label}
        </button>
    )
}
