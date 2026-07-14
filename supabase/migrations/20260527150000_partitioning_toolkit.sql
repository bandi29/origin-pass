-- Partitioning toolkit: helper functions to manage monthly range partitions on
-- append-only event tables (passport_scans, share_clicks, audit_logs, etc.).
--
-- This migration does NOT migrate existing tables — that requires a maintenance
-- window. It provides the SQL primitives the cutover runbook depends on.
--
-- Migration cutover plan: see docs/PARTITIONING_RUNBOOK.md
--
-- Why declarative partitioning:
--   - Each month becomes its own physical table; DROP PARTITION is instant
--     retention (no big DELETE / autovacuum stalls).
--   - Indexes are per-partition; new partitions are fast to write to even when
--     historical partitions are huge.
--   - `EXPLAIN` shows partition pruning: queries with a WHERE on the partition
--     key only touch relevant months.

-- ---------------------------------------------------------------------------
-- 1) Create the next monthly partition for a parent table.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_month_partition(
  p_parent  text,           -- e.g. 'passport_scans'
  p_key     text,           -- partition key column name, e.g. 'scan_timestamp'
  p_year    int,
  p_month   int
)
returns text                -- name of the partition created (or pre-existing)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start    timestamptz;
  v_end      timestamptz;
  v_name     text;
  v_exists   boolean;
begin
  v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_end   := v_start + interval '1 month';
  v_name  := format('%s_y%sm%s', p_parent, p_year::text, lpad(p_month::text, 2, '0'));

  select exists(
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where c.relname = v_name and n.nspname = 'public'
  ) into v_exists;

  if v_exists then
    return v_name;
  end if;

  execute format(
    'create table public.%I partition of public.%I for values from (%L) to (%L)',
    v_name, p_parent, v_start, v_end
  );

  -- Cascade local indexes from the parent's index template are automatic for
  -- declarative partitioning. Nothing else needed here.
  return v_name;
end;
$$;

revoke all on function public.ensure_month_partition(text, text, int, int) from public;
grant execute on function public.ensure_month_partition(text, text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Roll forward: ensure current month + next month partitions exist.
--    Call from a daily cron (Supabase scheduler or app-side BullMQ repeatable
--    job). Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.roll_forward_partitions(
  p_parent text,
  p_key    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now date := (now() at time zone 'UTC')::date;
  v_next date := (v_now + interval '1 month')::date;
begin
  perform public.ensure_month_partition(
    p_parent, p_key, extract(year from v_now)::int, extract(month from v_now)::int
  );
  perform public.ensure_month_partition(
    p_parent, p_key, extract(year from v_next)::int, extract(month from v_next)::int
  );
end;
$$;

revoke all on function public.roll_forward_partitions(text, text) from public;
grant execute on function public.roll_forward_partitions(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3) Retention: detach partitions older than `p_retain_months`. Detached
--    partitions become independent tables you can archive to cold storage
--    (S3 export, parquet dump) and then drop.
-- ---------------------------------------------------------------------------
create or replace function public.detach_partitions_older_than(
  p_parent          text,
  p_retain_months   int
)
returns table (detached_partition text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff date := (date_trunc('month', now() at time zone 'UTC')
                    - make_interval(months => p_retain_months))::date;
  v_part   record;
begin
  for v_part in
    select c.relname as partition_name
      from pg_inherits i
      join pg_class c on c.oid = i.inhrelid
      join pg_class p on p.oid = i.inhparent
      join pg_namespace n on n.oid = c.relnamespace
     where p.relname = p_parent
       and n.nspname = 'public'
  loop
    -- Partition names follow `<parent>_y<YYYY>m<MM>`. Parse the date out.
    declare
      v_yr  int := nullif(substring(v_part.partition_name from '_y(\d{4})m'), '')::int;
      v_mo  int := nullif(substring(v_part.partition_name from 'm(\d{2})$'), '')::int;
      v_partition_start date;
    begin
      if v_yr is null or v_mo is null then
        continue;
      end if;
      v_partition_start := make_date(v_yr, v_mo, 1);
      if v_partition_start < v_cutoff then
        execute format('alter table public.%I detach partition public.%I',
                       p_parent, v_part.partition_name);
        detached_partition := v_part.partition_name;
        return next;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.detach_partitions_older_than(text, int) from public;
grant execute on function public.detach_partitions_older_than(text, int) to service_role;

comment on function public.ensure_month_partition(text, text, int, int) is
  'Create a monthly RANGE partition for a parent table. Idempotent.';
comment on function public.roll_forward_partitions(text, text) is
  'Ensure current + next month partitions exist. Run daily via cron.';
comment on function public.detach_partitions_older_than(text, int) is
  'Detach partitions older than N months. Detached tables can then be exported and dropped.';
