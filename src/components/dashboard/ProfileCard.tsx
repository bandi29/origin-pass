"use client"

import { useState } from "react"
import { updateProfile } from "@/actions/update-profile"
import { Loader2, UserCircle2 } from "lucide-react"

interface ProfileCardProps {
  email: string | null
  userId: string
  brandName: string | null
  subscriptionStatus: string | null
}

export default function ProfileCard({
  email,
  userId,
  brandName,
  subscriptionStatus,
}: ProfileCardProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null)

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
        setMessage("Profile updated.")
        setMessageType("success")
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-2 mb-4">
        <UserCircle2 className="w-5 h-5 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Profile</h3>
      </div>

      <div className="space-y-2 text-sm text-slate-600 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Signed in as</span>
          <span className="font-medium text-slate-700">{email || "Unknown"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">User ID</span>
          <span className="font-mono text-xs text-slate-600">{userId.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Plan</span>
          <span className="text-slate-700">{subscriptionStatus || "active"}</span>
        </div>
      </div>
      <div className="mb-4 text-xs text-slate-500">
        🔒 Your data is private and visible only to your brand.
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-[11px] text-slate-500">
          <span className="text-rose-500">*</span> Required fields
        </p>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Brand Name <span className="text-rose-500">*</span>
          </label>
          <input
            name="brandName"
            defaultValue={brandName || ""}
            required
            placeholder="Your brand name"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Profile
        </button>

        {message && (
          <div className={`text-xs rounded-lg px-3 py-2 ${
            messageType === "success"
              ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
              : "text-rose-700 bg-rose-50 border border-rose-100"
          }`}>
            {message}
          </div>
        )}
      </form>
    </div>
  )
}
