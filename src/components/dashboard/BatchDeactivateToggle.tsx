"use client"

import { useState } from "react"
import { toggleBatchActive } from "@/actions/toggle-batch-active"
import { useRouter } from "next/navigation"

interface BatchDeactivateToggleProps {
  batchId: string
  isActive: boolean
}

export default function BatchDeactivateToggle({ batchId, isActive }: BatchDeactivateToggleProps) {
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(isActive)
  const router = useRouter()

  async function handleToggle() {
    setLoading(true)
    const result = await toggleBatchActive(batchId, !active)
    if (result.success) {
      setActive(!active)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600">
        {active ? 'Active' : 'Deactivated'}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          active ? 'bg-emerald-600' : 'bg-slate-300'
        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            active ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
