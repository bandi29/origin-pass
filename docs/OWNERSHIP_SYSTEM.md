# OriginPass Ownership System

## 1. System Overview

- User scans QR → verification page
- If valid → "Claim Ownership" CTA
- User signs in OR continues as guest (email/phone)
- System creates ownership record
- One active owner per passport; new claim marks previous as transferred

## 2. User Flow

| Step | Action |
|------|--------|
| 1 | User scans QR → lands on `/verify/{token}` |
| 2 | If valid → show "Claim Ownership" button |
| 3 | User clicks → `/claim/{token}` (sign in or guest) |
| 4 | User submits: email OR phone, optional name |
| 5 | POST /api/ownership/claim |
| 6 | Redirect to `/ownership/success` |

## 3. Routes

| Route | Purpose |
|-------|---------|
| `/verify/{token}` | Verification + Claim CTA |
| `/claim/{token}` | Claim form (email/phone, name) |
| `/ownership/success` | Confirmation after claim |
| `/ownership/history` | User's claimed products (authenticated) |

## 4. Ownership Rules

- One active owner per passport
- New claim → previous owner marked `transferred`
- First claim = strongest ownership signal
- Brand can revoke via dashboard

## 5. Warranty

- `warranty_start_date`: set on first claim
- `warranty_end_date`: computed from product warranty period
- Transfer: warranty may transfer or reset (configurable)

## 6. API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ownership/claim` | Claim ownership |
| GET | `/api/ownership/{passport_id}` | Get current owner + history |
| POST | `/api/ownership/transfer` | Initiate transfer |
