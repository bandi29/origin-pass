-- Performance indexes for high-cardinality foreign keys and frequent query columns.
-- Following the security & performance review, the following columns are queried by
-- equality or `.in(...)` on a per-tenant basis without a supporting index. CREATE INDEX
-- CONCURRENTLY is preferred but is not supported inside a transaction block; Supabase
-- runs migrations in a transaction, so we use regular CREATE INDEX IF NOT EXISTS. For
-- very large tables, consider running these manually with CONCURRENTLY outside the
-- migration system.

-- Scan analytics: most queries filter scans by passport_id (timeline) or qr_identity_id (anomalies).
CREATE INDEX IF NOT EXISTS idx_scan_events_passport_id
  ON public.scan_events (passport_id);

CREATE INDEX IF NOT EXISTS idx_scan_events_qr_identity_id_scanned_at
  ON public.scan_events (qr_identity_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_events_scanned_at
  ON public.scan_events (scanned_at DESC);

-- Share analytics
CREATE INDEX IF NOT EXISTS idx_share_clicks_passport_id
  ON public.share_clicks (passport_id);

CREATE INDEX IF NOT EXISTS idx_share_events_passport_id
  ON public.share_events (passport_id);

-- Verification / authenticity queries
CREATE INDEX IF NOT EXISTS idx_verification_events_product_id
  ON public.verification_events (product_id);

-- QR identity lookups
CREATE INDEX IF NOT EXISTS idx_qr_identities_product_id
  ON public.qr_identities (product_id);

CREATE INDEX IF NOT EXISTS idx_qr_activation_logs_qr_identity_id
  ON public.qr_activation_logs (qr_identity_id);

-- Batch jobs are listed and filtered per creator and per organization.
CREATE INDEX IF NOT EXISTS idx_qr_batch_jobs_created_by_created_at
  ON public.qr_batch_jobs (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_batch_jobs_organization_id
  ON public.qr_batch_jobs (organization_id);

-- Team activity logs are scanned by organization and by actor.
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_org_created_at
  ON public.team_activity_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_activity_logs_actor
  ON public.team_activity_logs (actor_id);

-- Organization-scoped product lookups (auth filters)
CREATE INDEX IF NOT EXISTS idx_products_brand_id
  ON public.products (brand_id);

CREATE INDEX IF NOT EXISTS idx_products_organization_id
  ON public.products (organization_id);

-- Passport lookups by product
CREATE INDEX IF NOT EXISTS idx_passports_product_id_created_at
  ON public.passports (product_id, created_at DESC);

-- Import jobs filtered by user
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id_created_at
  ON public.import_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_jobs_content_hash
  ON public.import_jobs (user_id, content_hash);

-- Counterfeit alert / investigation lookups
CREATE INDEX IF NOT EXISTS idx_qr_anomaly_events_qr_identity_id_occurred_at
  ON public.qr_anomaly_events (qr_identity_id, occurred_at DESC);
