"use client"

import { useState } from "react"
import { updateProfile } from "@/actions/update-profile"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface ProfileSettingsFormProps {
  brandName: string | null
}

export default function ProfileSettingsForm({ brandName }: ProfileSettingsFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)
  const router = useRouter()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setMessageType(null)

    const form = event.currentTarget
    try {
      const formData = new FormData(form)
      const result = await updateProfile(formData)
      if (!result.success) {
        setMessage(result.error || "Unable to update profile")
        setMessageType("error")
      } else {
        setMessage("Profile updated successfully")
        setMessageType("success")
        router.refresh()
      }
    } catch (error) {
      console.error(error)
      setMessage("We couldn't save your profile right now. Please try again.")
      setMessageType("error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-xs text-slate-500">
        <span className="text-rose-500">*</span> Required fields
      </p>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Brand Name <span className="text-rose-500">*</span>
        </label>
        <input
          name="brandName"
          defaultValue={brandName || ""}
          required
          placeholder="Your brand name"
          className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
        />
        <p className="text-xs text-slate-400">This name appears on your public product passports</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Save Changes
      </button>

      {message && (
        <div className={`text-xs rounded-lg px-3 py-2 ${
          messageType === "success"
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' 
            : 'text-rose-700 bg-rose-50 border border-rose-100'
        }`}>
          {message}
        </div>
      )}
    </form>
  )
}
