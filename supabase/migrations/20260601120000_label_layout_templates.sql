-- Persisted Label Studio layout templates (full snapshot JSONB)

create table if not exists public.label_layout_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  layout jsonb not null default '{}'::jsonb,
  dimensions text not null default 'Custom',
  cols integer not null default 1 check (cols > 0),
  rows integer not null default 1 check (rows > 0),
  double_sided boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists label_layout_templates_brand_name_unique
  on public.label_layout_templates (brand_id, lower(trim(name)));

create index if not exists label_layout_templates_brand_id_idx
  on public.label_layout_templates (brand_id);

create or replace function public.set_label_layout_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists label_layout_templates_set_updated_at on public.label_layout_templates;
create trigger label_layout_templates_set_updated_at
  before update on public.label_layout_templates
  for each row
  execute function public.set_label_layout_templates_updated_at();

alter table public.label_layout_templates enable row level security;

drop policy if exists "label_layout_templates_all_own" on public.label_layout_templates;
create policy "label_layout_templates_all_own"
on public.label_layout_templates
for all
to authenticated
using (brand_id = auth.uid())
with check (brand_id = auth.uid() and created_by = auth.uid());
