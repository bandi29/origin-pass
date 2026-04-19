# Digital Product Passports Module — Architecture

Complete UI/UX structure, page hierarchy, functional logic, and scalable architecture for the OriginPass Digital Product Passports module.

---

## 1. PAGE HIERARCHY

| Route | Purpose |
|-------|---------|
| `/product/passports` | **List page** — Browse, search, filter, and manage all passports. Primary entry point for the module. |
| `/product/passports/create` | **Create flow** — Multi-step wizard to create passports (select product → serial config → generate → QR). |
| `/product/passports/[passport_id]` | **Detail page** — Single passport view with tabbed sections (Overview, QR, Scans, Verification, Settings). |
| `/product/passports/templates` | **Templates** — Reusable passport templates by product category (future). |
| `/product/passports/activity` | **Activity feed** — Recent passport creation, scans, and status changes across the org (future). |

---

## 2. PASSPORT LIST PAGE

**Route:** `/product/passports`

### Layout

- **Header:** Title "Digital Product Passports", subtitle with count
- **Toolbar:** Search bar (full-width), filter chips (Product, Status, Date range), "Create Passport" CTA
- **Table:** Responsive, sortable columns

### Table Columns

| Column | Description |
|--------|-------------|
| Passport ID | `passport_uid` — unique identifier |
| Product | Product name (from `products`) |
| Serial Number | Human-readable serial |
| Status | Badge: active, inactive, revoked, flagged |
| Scan Count | Number of scans |
| Created Date | Formatted date |
| Actions | Dropdown or icon buttons |

### Actions

- **View Passport** → `/product/passports/[id]`
- **Download QR** → Triggers QR download (PNG/SVG)
- **Deactivate Passport** → Updates status to `inactive` (with confirmation)

### UX

- Search: client-side or server-side filter on passport_uid, serial_number, product name
- Filters: Product dropdown, Status multi-select, Date range picker
- Empty state: CTA to create first passport
- Pagination or infinite scroll for large lists

---

## 3. CREATE PASSPORT FLOW

**Route:** `/product/passports/create`

### Steps (4 steps, <60 seconds target)

| Step | Title | Fields |
|------|-------|--------|
| 1 | Select Product | Product dropdown (required) |
| 2 | Serial Generation | Serial format (prefix + sequence), Batch size, Manufacturing date, Origin country |
| 3 | Generate | Review summary, "Generate" button |
| 4 | QR Identity | QR preview, Download PNG/SVG, Copy verification URL |

### Form Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product | Select | Yes | From user's products |
| Serial format | Text | Yes | e.g. `OP-{YYYY}-{SEQ}` or `BRAND-{SEQ}` |
| Batch size | Number | Yes | 1–1000 |
| Manufacturing date | Date | No | For compliance |
| Origin country | Select | No | ISO country code |

### UX

- Progress indicator (1–4)
- Validation per step before advancing
- Summary step before final generation
- Success state with QR and next actions

---

## 4. PASSPORT DETAIL PAGE

**Route:** `/product/passports/[passport_id]`

### Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Passport ID, Product, Serial, Manufacturing info, Creation date |
| **QR Code** | QR preview, Download (PNG, SVG), Embed code snippet |
| **Scan Activity** | Table: Scan Date, Location (country/city), Device, Verification Result |
| **Verification Status** | Current status, history, manual override (future) |
| **Settings** | Deactivate, Revoke, Flag (with reason) |

### Overview Tab Fields

- Passport ID (`passport_uid`)
- Product name + link
- Serial Number
- Manufacturing date, Origin
- Creation date
- Status badge

### QR Code Tab

- QR preview (scannable)
- Download buttons: PNG, SVG
- Embed code: `<img src="https://originpass.com/api/passports/{id}/qr" />` or similar

### Scan Activity Tab

| Column | Source |
|--------|--------|
| Scan Date | `scan_timestamp` |
| Location | `location_country`, `location_city` |
| Device | `device_type` or parsed from `user_agent` |
| Result | `scan_result` (valid, duplicate, invalid, suspicious) |

---

## 5. QR CODE GENERATION LOGIC

### Verification URL

```
https://originpass.com/verify/{passport_uid}
```

- `passport_uid` is a unique, URL-safe identifier (e.g. base64url of UUID or custom format)
- Same URL is used for QR and direct link

### Uniqueness

- `passport_uid` — unique constraint in DB
- `serial_number` — unique constraint in DB
- On create: generate `passport_uid` via crypto (e.g. `randomBytes(16).toString('base64url')`)
- Serial format: user-defined prefix + sequence; validate no collision before insert

### QR Generation

- Use `qrcode` or `qrcode.react` library
- Encode full verification URL
- PNG: `QRCode.toDataURL(url, { width: 256 })`
- SVG: `QRCode.toString(url, { type: 'svg' })`

---

## 6. PASSPORT STATUS MANAGEMENT

| Status | When Triggered |
|--------|----------------|
| **active** | Default on creation; passport is valid and scannable |
| **inactive** | Brand deactivates (soft pause); not shown as "verified" but not revoked |
| **revoked** | Brand revokes (e.g. counterfeit, lost); scan shows "Revoked" |
| **flagged** | System or manual flag (e.g. suspicious scan pattern); under review |

### Schema Alignment

Current DB enum: `active`, `revoked`, `expired`, `counterfeit_flagged`. Map:

- `inactive` → use `expired` or add `inactive` to enum
- `flagged` → `counterfeit_flagged`

---

## 7. DATABASE STRUCTURE

### products

```sql
id, brand_id, name, story, materials, origin, lifecycle, image_url, created_at
```

### passports

```sql
id              uuid PRIMARY KEY
passport_uid    text UNIQUE NOT NULL   -- verification URL slug
product_id      uuid REFERENCES products(id)
serial_number   text UNIQUE NOT NULL
status          passport_status DEFAULT 'active'
blockchain_hash text                    -- future
created_at      timestamptz
```

### passport_scans

```sql
id              uuid PRIMARY KEY
passport_id     uuid REFERENCES passports(id)
scan_timestamp  timestamptz
location_country text
location_city   text
device_type     text
ip_address      text
scan_result     passport_scan_result    -- valid, duplicate, invalid, suspicious
risk_score      numeric(5,2)            -- future
created_at      timestamptz
```

---

## 8. API ENDPOINTS

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passports` | List passports (query: productId, status, from, to, limit) |
| POST | `/api/passports` | Create passport |
| GET | `/api/passports/[id]` | Get passport details |
| PATCH | `/api/passports/[id]` | Update status |
| GET | `/api/passports/[id]/qr` | Get QR image (PNG) |
| POST | `/api/passports/[id]/scan` | Record scan (public/anon) |
| GET | `/api/passports/[id]/scans` | List scans for passport |

### Example: POST /api/passports

**Request:**
```json
{
  "productId": "uuid",
  "serialNumber": "OP-2026-001",
  "passportUid": "optional-override",
  "status": "active"
}
```

**Response (201):**
```json
{
  "passport": {
    "id": "uuid",
    "passportUid": "abc123...",
    "productId": "uuid",
    "serialNumber": "OP-2026-001",
    "status": "active",
    "createdAt": "2026-03-15T..."
  }
}
```

---

## 9. FUTURE SCALABILITY

| Feature | Architecture Support |
|---------|----------------------|
| **Batch generation** | Add `POST /api/passports/batch` with quantity; reuse serial format logic |
| **Supply chain traceability** | Add `batch_id`, `supply_chain_events` table; link passports to batches |
| **Counterfeit detection** | Use `scan_result`, `risk_score`; ML on scan patterns; alert on `suspicious` |
| **EU DPP compliance** | `products.json_ld`; extend passport with DPP fields; export endpoints |

### Extensibility

- Passport metadata: JSONB column for custom fields
- Webhooks: emit events on create, scan, status change
- Audit log: `audit_logs` table for all mutations

---

## 10. UI COMPONENT STRUCTURE

```
components/
  passports/
    PassportTable.tsx       -- Table with columns, sort, actions
    PassportFilters.tsx     -- Search, product, status, date filters
    PassportStatusBadge.tsx  -- Status pill (active, revoked, etc.)
    CreatePassportForm.tsx   -- Multi-step create wizard
    CreatePassportStepProduct.tsx
    CreatePassportStepSerial.tsx
    CreatePassportStepGenerate.tsx
    CreatePassportStepQR.tsx
    QRCodeViewer.tsx         -- QR preview + download
    ScanHistoryTable.tsx     -- Scan activity table
    PassportDetailTabs.tsx   -- Tab container for detail page
    PassportOverviewTab.tsx
    PassportQRTab.tsx
    PassportScansTab.tsx
    PassportSettingsTab.tsx
```

### Component Interactions

- **PassportTable** uses **PassportFilters** for toolbar; renders **PassportStatusBadge** per row
- **CreatePassportForm** orchestrates steps; each step is a child component
- **PassportDetailTabs** switches between Overview, QR, Scans, Settings
- **QRCodeViewer** used in Create flow (step 4) and Detail QR tab
