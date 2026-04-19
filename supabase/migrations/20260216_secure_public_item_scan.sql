-- Security hardening: Restrict public_item_scan to active batches only
-- and add documentation for SECURITY DEFINER design decision.
-- See: Security Advisor note on public_item_scan view

-- Recreate view with filter: only items from active batches are publicly visible.
-- Inactive/revoked batches are excluded from public verification.
create or replace view public_item_scan with (security_invoker = false) as
select
  items.serial_id,
  products.name as product_name,
  products.story,
  products.image_url,
  batches.production_run_name,
  profiles.brand_name
from items
join batches on batches.id = items.batch_id
join products on products.id = batches.product_id
join profiles on profiles.id = items.brand_id
where batches.is_active = true;

-- Document intentional SECURITY DEFINER: anon cannot read base tables due to RLS.
-- This view is the controlled public API for QR verification; exposes only safe fields.
comment on view public_item_scan is 'Public verification API (SECURITY DEFINER by design). Exposes only safe product/brand fields. Restricted to active batches.';
