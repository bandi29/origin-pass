"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { marketingIconBoxClass } from "@/components/marketing/marketingLayout"
import { marketingSection } from "@/components/marketing/marketingSection"
import {
  MARKETING_PASSPORT_PREVIEW_DEMO,
  PassportPagePreviewCard,
} from "@/components/passports/PassportPagePreviewCard"
import { BarChart3, QrCode } from "lucide-react"

const body = "max-w-2xl text-[16px] leading-[26px] text-gray-600"

const tabs = [
  { id: "passport" as const, label: "Passport page" },
  { id: "scan" as const, label: "QR scan flow" },
  { id: "analytics" as const, label: "Analytics" },
]

export function HomeProductShowcase() {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("passport")

  return (
    <div className="flex w-full flex-col gap-8 md:gap-10">
      <div
        className="flex w-full max-w-full flex-wrap gap-6 border-b border-border transition-all duration-200 ease-smooth"
        role="tablist"
        aria-label="Product showcase"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              className={
                selected
                  ? "border-b-2 border-primary pb-3 text-sm font-medium text-primary transition-all duration-200 ease-smooth"
                  : "border-b-2 border-transparent pb-3 text-sm text-muted transition-all duration-200 ease-smooth hover:text-primary"
              }
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className={`${marketingSection.card} w-full`}>
        {active === "passport" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex w-full justify-center"
          >
            <PassportPagePreviewCard
              productName={MARKETING_PASSPORT_PREVIEW_DEMO.productName}
              subtitle={MARKETING_PASSPORT_PREVIEW_DEMO.subtitle}
              productStory={MARKETING_PASSPORT_PREVIEW_DEMO.productStory}
              materials={MARKETING_PASSPORT_PREVIEW_DEMO.materials}
              showStructuredDataTags
              scanHint={`${MARKETING_PASSPORT_PREVIEW_DEMO.scanHint} Customers see proof in seconds — no app required.`}
              className="max-w-full"
            />
          </motion.div>
        )}
        {active === "scan" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="group flex flex-col items-center justify-center py-4"
          >
            <div className="rounded-2xl bg-green-50/90 p-8 shadow-sm transition-all duration-200 ease-out group-hover:shadow-md">
              <QrCode
                className="mx-auto h-24 w-24 text-green-600 transition-transform duration-200 ease-out group-hover:scale-110"
                aria-hidden
              />
            </div>
            <p className={`mt-8 max-w-2xl text-center ${body}`}>
              One scan opens your passport: authenticity, story, and ownership actions on any phone.
            </p>
          </motion.div>
        )}
        {active === "analytics" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center gap-4">
              <div className={marketingIconBoxClass("orange")}>
                <BarChart3 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Scan insights</p>
                <p className="text-2xl font-bold tabular-nums text-black">1,248</p>
                <p className="text-sm text-gray-500">Last 30 days · sample</p>
              </div>
            </div>
            <div className="mt-6 h-24 rounded-xl bg-gradient-to-t from-gray-100/80 to-transparent" />
          </motion.div>
        )}
      </div>
    </div>
  )
}
