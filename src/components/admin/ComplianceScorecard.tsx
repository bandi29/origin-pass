"use client"

import clsx from "clsx"
import type { ComplianceScoreResult } from "@/lib/compliance-score"

type Props = {
  result: ComplianceScoreResult
}

function riskTone(score: number): "critical" | "warning" | "success" {
  if (score >= 86) return "success"
  if (score >= 50) return "warning"
  return "critical"
}

function CircularGauge({ score, tone }: { score: number; tone: "critical" | "warning" | "success" }) {
  const clamped = Math.max(0, Math.min(100, score))
  const ring =
    tone === "success" ? "#008060" : tone === "warning" ? "#B98900" : "#D72C0D"
  const track = "#E3E3E3"

  return (
    <div
      className="relative h-[88px] w-[88px] shrink-0"
      role="img"
      aria-label={`EU compliance readiness ${clamped} percent`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${ring} ${clamped * 3.6}deg, ${track} 0deg)`,
        }}
      />
      <div className="absolute inset-[8px] flex items-center justify-center rounded-full bg-white">
        <span className="text-lg font-bold tabular-nums text-[#202223]">{clamped}%</span>
      </div>
    </div>
  )
}

/**
 * Shopify-admin-styled EU ESPR readiness scorecard for the Product Passport Editor.
 * Polaris-inspired card (no @shopify/polaris dependency in this app).
 */
export function ComplianceScorecard({ result }: Props) {
  const tone = riskTone(result.score)
  const badgeClass =
    tone === "success"
      ? "bg-[#eaf4f1] text-[#0c5132] ring-[#aee9d1]"
      : tone === "warning"
        ? "bg-[#fff5ea] text-[#5c3c00] ring-[#ffd79d]"
        : "bg-[#fff0ed] text-[#8e1b16] ring-[#fdd0cb]"

  const barClass =
    tone === "success" ? "bg-[#008060]" : tone === "warning" ? "bg-[#B98900]" : "bg-[#D72C0D]"

  return (
    <section
      aria-labelledby="eu-compliance-scorecard-title"
      className="rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
    >
      <div className="flex flex-wrap items-start gap-4">
        <CircularGauge score={result.score} tone={tone} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="eu-compliance-scorecard-title"
                className="text-sm font-semibold text-[#202223]"
              >
                EU Compliance Readiness
              </h2>
              <span
                className={clsx(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                  badgeClass,
                )}
              >
                {result.riskLabel}
              </span>
            </div>
            <p className="text-xs text-[#6d7175]">
              Score {result.score}/100 · Tier: {result.tier}. Based on mandatory ESPR passport
              fields for EU market readiness.
            </p>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[#e3e3e3]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={result.score}
            aria-label="EU compliance readiness"
          >
            <div
              className={clsx("h-full rounded-full transition-[width] duration-300 ease-out", barClass)}
              style={{ width: `${result.score}%` }}
            />
          </div>

          {result.missingItems.length > 0 ? (
            <div className="rounded-lg border border-[#e3e3e3] bg-[#fafbfb] px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6d7175]">
                Complete to improve score
              </p>
              <ul className="mt-2 space-y-1.5">
                {result.missingItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm text-[#202223]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8c9196]" aria-hidden />
                    <a
                      href={item.anchor}
                      className="font-medium text-[#2c6ecb] underline-offset-2 hover:underline"
                    >
                      {item.label}
                    </a>
                    <span className="shrink-0 text-xs text-[#8c9196]">+{item.weight}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-lg border border-[#aee9d1] bg-[#eaf4f1] px-3.5 py-2.5 text-sm text-[#0c5132]">
              All weighted ESPR fields are complete. This product is marked EU ESPR Export Ready.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
