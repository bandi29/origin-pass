# OriginPass Security Architecture

## 1. System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  QR Scan    │────▶│  /verify/{token}  │────▶│  Verification   │
│  (Mobile)   │     │  or API          │     │  Pipeline       │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                       ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
                       │ Token Validate│         │ Fraud Detect │         │ Record Scan  │
                       └──────────────┘         └──────────────┘         └──────────────┘
```

## 2. Secure Token Structure

**URL format:** `https://originpass.com/verify/{secure_token}`

### Token Requirements
- Non-guessable (cryptographic randomness)
- Cannot be reverse-engineered to passport ID
- Maps to passport internally via lookup table

### Generation (HMAC + Random)
```
verify_token = base64url(32 random bytes)
```
- 32 bytes = 256 bits entropy
- Base64url encoding: URL-safe, ~43 chars
- Stored in `passports.verify_token` (unique, indexed)

### Backward Compatibility
- Legacy URLs using `serial_number` (e.g. OP-2024-00001) still work
- New passports get `verify_token`; QR uses token URL
- Lookup: try token first, then serial_number

## 3. Verification Flow

| Step | Action |
|------|--------|
| 1 | User scans QR → GET /verify/{token} |
| 2 | API validates token format |
| 3 | Lookup passport by verify_token or serial_number |
| 4 | Check passport status (active/revoked/flagged) |
| 5 | Run fraud detection (risk score) |
| 6 | Insert passport_scans record |
| 7 | Return response: valid / suspicious / fraud |

## 4. Fraud Detection Rules

| Rule | Weight | Threshold |
|------|--------|------------|
| Duplicate scans (same QR, short period) | +8/scan | 15 min window |
| Same IP scans | +10/scan | 15 min window |
| Geographic anomaly (multi-country) | +25 | 2+ countries in 1 hr |
| Velocity (scans/min) | +15 | >5/min |
| First scan | -5 (trust boost) | N/A |
| Device fingerprint change | +20 | Same passport, new device pattern |

**Risk score bands:**
- 0–30: valid (green)
- 30–70: suspicious (yellow)
- 70+: fraud (red)

## 5. API Response Design

```json
{
  "status": "valid",
  "product_name": "Leather Satchel",
  "brand": "Aurum Leatherworks",
  "message": "Authenticity confirmed.",
  "scan_count": 12,
  "first_scan_date": "2024-01-15T10:30:00Z",
  "risk_score": 15,
  "ownership_status": "claimed"
}
```

## 6. Security Best Practices

- Never expose internal UUIDs in URLs or responses
- Rate limit: 60 req/min per IP for /api/verify (implemented)
- Log all verification attempts (passport_scans)
- Use ip_hash (SHA256) for fraud, not raw IP
- Signed tokens for future JWT-style expiry
- Token validation: accept verify_token (secure) or serial_number (legacy)
