import type { SupabaseClient } from "@supabase/supabase-js"
import { getRuleConfig } from "./rule-engine"
import type { ScanSignalInput, VerificationFinding, VerificationRule } from "./types"

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type ScanRow = {
  scanned_at: string
  latitude: number | null
  longitude: number | null
  geo_country: string | null
  geo_city: string | null
}

export async function evaluateImpossibleTravel(
  supabase: SupabaseClient,
  input: ScanSignalInput,
  rules: VerificationRule[],
): Promise<VerificationFinding | null> {
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") {
    return null
  }
  const { data } = await supabase
    .from("scan_events")
    .select("scanned_at, latitude, longitude, geo_country, geo_city")
    .eq("product_id", input.productId)
    .order("scanned_at", { ascending: false })
    .limit(1)

  const last = (data?.[0] ?? null) as ScanRow | null
  if (!last || typeof last.latitude !== "number" || typeof last.longitude !== "number") {
    return null
  }

  const scannedAtMs = new Date(input.scannedAt).getTime()
  const prevMs = new Date(last.scanned_at).getTime()
  if (!Number.isFinite(scannedAtMs) || !Number.isFinite(prevMs) || scannedAtMs <= prevMs) {
    return null
  }

  const km = haversineKm(last.latitude, last.longitude, input.latitude, input.longitude)
  const hours = (scannedAtMs - prevMs) / 3_600_000
  const kmPerHour = km / Math.max(hours, 0.01)
  const rule = getRuleConfig(rules, "impossible_travel")
  const speedThreshold = rule.thresholdValue ?? 850
  if (kmPerHour <= speedThreshold) return null

  return {
    ruleType: "impossible_travel",
    severity: rule.severity,
    scoreImpact: rule.scoreImpact,
    message: "Impossible travel pattern detected between recent scans.",
    metadata: {
      prevScanAt: last.scanned_at,
      prevGeo: { country: last.geo_country, city: last.geo_city },
      kmDistance: Number(km.toFixed(2)),
      inferredSpeedKmh: Number(kmPerHour.toFixed(2)),
      thresholdKmh: speedThreshold,
    },
  }
}
