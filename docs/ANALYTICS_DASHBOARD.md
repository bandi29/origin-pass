# Analytics Dashboard

High-performance analytics dashboard for OriginPass brands.

## Route

- **Main dashboard**: `/analytics`
- **Query params**: `?range=7d|30d|90d` (date range preset)

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Analytics                    [7d] [30d] [90d]                    │
├─────────────────────────────────────────────────────────────────┤
│ [Total Scans] [Unique Products] [Active Passports] [Fraud] [Claims] │
├──────────────────────────────────┬──────────────────────────────┤
│ Scan activity over time (line)    │ Ownership growth (line)      │
├──────────────────────────────────┼──────────────────────────────┤
│ Valid vs suspicious (bar)         │ Top countries (list)          │
├──────────────────────────────────┴──────────────────────────────┤
│ Top products (table)              │ Fraud & suspicious panel      │
└─────────────────────────────────────────────────────────────────┘
```

## Component Structure

```
src/
├── app/[locale]/analytics/
│   └── page.tsx              # Server component, fetches data
├── components/analytics/
│   ├── AnalyticsDashboardClient.tsx  # Client wrapper, filters
│   ├── AnalyticsFilters.tsx         # Date range preset buttons
│   ├── KpiCard.tsx                  # KPI with trend
│   ├── LineChartCard.tsx            # Scans/ownership over time
│   ├── BarChartCard.tsx             # Fraud distribution
│   ├── TopCountriesCard.tsx         # Geographic list
│   ├── TopProductsTable.tsx         # Top products table
│   └── FraudAlertPanel.tsx          # Suspicious scans
└── backend/modules/analytics/
    ├── dashboard.ts                 # Data layer
    └── repository.ts                 # Per-passport analytics
```

## SQL Queries (conceptual)

### Total scans
```sql
SELECT COUNT(*) FROM passport_scans
WHERE passport_id IN (scoped_ids)
  AND scan_timestamp BETWEEN ? AND ?;
```

### Scans over time
```sql
SELECT date_trunc('day', scan_timestamp)::date AS date, COUNT(*) AS scans
FROM passport_scans
WHERE passport_id IN (scoped_ids)
  AND scan_timestamp BETWEEN ? AND ?
GROUP BY 1 ORDER BY 1;
```

### Top countries
```sql
SELECT location_country AS country, COUNT(*) AS count
FROM passport_scans
WHERE passport_id IN (scoped_ids)
  AND scan_timestamp BETWEEN ? AND ?
  AND location_country IS NOT NULL
GROUP BY location_country
ORDER BY count DESC LIMIT 10;
```

### Fraud distribution
```sql
SELECT scan_result AS status, COUNT(*) AS count
FROM passport_scans
WHERE passport_id IN (scoped_ids)
  AND scan_timestamp BETWEEN ? AND ?
GROUP BY scan_result;
```

### Top products
```sql
SELECT p.product_id, pr.name, COUNT(*) AS scans
FROM passport_scans s
JOIN passports p ON p.id = s.passport_id
JOIN products pr ON pr.id = p.product_id
WHERE s.passport_id IN (scoped_ids)
  AND s.scan_timestamp BETWEEN ? AND ?
GROUP BY p.product_id, pr.name
ORDER BY scans DESC LIMIT 10;
```

### Ownership growth
```sql
SELECT date_trunc('day', claimed_at)::date AS date, COUNT(*) AS claims
FROM ownership_records
WHERE passport_id IN (scoped_ids)
  AND claimed_at BETWEEN ? AND ?
GROUP BY 1 ORDER BY 1;
```

## API / Data Layer

- **Server actions** in `src/backend/modules/analytics/dashboard.ts`
- No REST API; data fetched in server components via `searchParams`
- Filters passed as `AnalyticsFilters`; date bounds computed server-side

## Performance

- **Indexes**: `idx_passport_scans_passport_timestamp`, `idx_passport_scans_result_timestamp`, `idx_ownership_records_passport_claimed`
- **Scoping**: All queries use `passport_id IN (scoped_ids)` from `getScopedPassportIds(userId)`
- **Date bounds**: Queries limited to selected range (7d, 30d, 90d)
- **Parallel fetches**: `Promise.all` for KPIs, charts, tables

## Future Scalability

- **Pre-aggregated tables**: `analytics_daily_scans`, `analytics_daily_ownership` for fast rollups
- **ClickHouse / BigQuery**: For millions of scans, export to columnar store
- **Redis cache**: Cache KPI and chart results with TTL (e.g. 5 min)
- **Real-time**: WebSocket or polling for live scan updates; add `last_scan_at` to dashboard
