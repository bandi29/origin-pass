-- Label Print Studio foundation tables

create table if not exists public.label_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Custom',
  template_type text not null default 'custom',
  dimensions text not null default '2x2 inch',
  print_type text not null default 'digital',
  printer_compatibility text[] not null default array['PDF standard']::text[],
  customization_level text not null default 'basic',
  serialized_fields text[] not null default array['serial_id','sku','passport_url']::text[],
  is_favorite boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.printer_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  printer_type text not null,
  driver_mode text not null default 'generic',
  profile_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.label_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.label_templates(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create table if not exists public.label_print_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.label_templates(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  printer_type text not null default 'PDF standard',
  status text not null default 'queued',
  export_format text not null default 'pdf',
  created_by uuid not null references auth.users(id) on delete cascade,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.label_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references auth.users(id) on delete cascade,
  print_job_id uuid references public.label_print_jobs(id) on delete cascade,
  asset_type text not null default 'label',
  file_name text,
  secure_url text,
  checksum text,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.label_exports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references auth.users(id) on delete cascade,
  print_job_id uuid references public.label_print_jobs(id) on delete set null,
  export_format text not null default 'pdf',
  status text not null default 'completed',
  file_name text,
  secure_url text,
  asset_count integer not null default 1,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.label_templates enable row level security;
alter table public.printer_profiles enable row level security;
alter table public.label_versions enable row level security;
alter table public.label_print_jobs enable row level security;
alter table public.label_assets enable row level security;
alter table public.label_exports enable row level security;

drop policy if exists "label_templates_select_own" on public.label_templates;
create policy "label_templates_select_own"
on public.label_templates
for select
to authenticated
using (brand_id = auth.uid() or is_system = true);

drop policy if exists "label_templates_insert_own" on public.label_templates;
create policy "label_templates_insert_own"
on public.label_templates
for insert
to authenticated
with check (brand_id = auth.uid() and is_system = false);

drop policy if exists "label_templates_update_own" on public.label_templates;
create policy "label_templates_update_own"
on public.label_templates
for update
to authenticated
using (brand_id = auth.uid() and is_system = false)
with check (brand_id = auth.uid() and is_system = false);

drop policy if exists "printer_profiles_all_own" on public.printer_profiles;
create policy "printer_profiles_all_own"
on public.printer_profiles
for all
to authenticated
using (brand_id = auth.uid())
with check (brand_id = auth.uid());

drop policy if exists "label_versions_select_own" on public.label_versions;
create policy "label_versions_select_own"
on public.label_versions
for select
to authenticated
using (exists (select 1 from public.label_templates t where t.id = template_id and t.brand_id = auth.uid()));

drop policy if exists "label_versions_insert_own" on public.label_versions;
create policy "label_versions_insert_own"
on public.label_versions
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "label_print_jobs_all_own" on public.label_print_jobs;
create policy "label_print_jobs_all_own"
on public.label_print_jobs
for all
to authenticated
using (brand_id = auth.uid())
with check (brand_id = auth.uid() and created_by = auth.uid());

drop policy if exists "label_assets_all_own" on public.label_assets;
create policy "label_assets_all_own"
on public.label_assets
for all
to authenticated
using (brand_id = auth.uid())
with check (brand_id = auth.uid());

drop policy if exists "label_exports_all_own" on public.label_exports;
create policy "label_exports_all_own"
on public.label_exports
for all
to authenticated
using (brand_id = auth.uid())
with check (brand_id = auth.uid() and created_by = auth.uid());
