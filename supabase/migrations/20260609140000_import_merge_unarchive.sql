-- Re-imported / upserted catalog rows must be visible in the active products list.
create or replace function public.merge_products_import_batch(
  p_brand_id uuid,
  p_organization_id uuid,
  p_import_log_id uuid,
  p_rows jsonb
) returns integer
language sql
security definer
set search_path = public
as $$
  with expanded as (
    select
      p_brand_id as brand_id,
      p_organization_id as organization_id,
      nullif(trim(value->>'name'), '') as name,
      nullif(trim(value->>'sku'), '') as sku,
      nullif(trim(value->>'category'), '') as category,
      nullif(trim(value->>'brand'), '') as brand,
      null::text as story,
      nullif(value->>'materials', '') as materials,
      nullif(trim(value->>'origin'), '') as origin,
      nullif(trim(value->>'origin_country'), '') as origin_country,
      nullif(trim(value->>'batch_number'), '') as batch_number,
      case
        when value->>'manufacture_date' is null or trim(value->>'manufacture_date') = '' then null
        else (value->>'manufacture_date')::date
      end as manufacture_date,
      coalesce(value->'certifications', '[]'::jsonb) as certifications,
      nullif(trim(value->>'import_qr_ref'), '') as import_qr_ref,
      p_import_log_id as import_log_id,
      null::text as lifecycle,
      null::text as image_url,
      false as is_archived,
      value->'json_ld' as json_ld
    from jsonb_array_elements(p_rows) as t(value)
  ),
  upserted as (
    insert into products (
      brand_id, organization_id, name, sku, category, brand, story, materials, origin,
      origin_country, batch_number, manufacture_date, certifications, import_qr_ref,
      import_log_id, lifecycle, image_url, is_archived, json_ld
    )
    select * from expanded
    on conflict (brand_id, sku_normalized) do update set
      organization_id = excluded.organization_id,
      name = excluded.name,
      sku = excluded.sku,
      category = excluded.category,
      brand = excluded.brand,
      materials = excluded.materials,
      origin = excluded.origin,
      origin_country = excluded.origin_country,
      batch_number = excluded.batch_number,
      manufacture_date = excluded.manufacture_date,
      certifications = excluded.certifications,
      import_qr_ref = excluded.import_qr_ref,
      import_log_id = excluded.import_log_id,
      json_ld = excluded.json_ld,
      is_archived = false,
      updated_at = timezone('utc'::text, now())
    returning 1
  )
  select count(*)::integer from upserted;
$$;

revoke all on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) to service_role;
