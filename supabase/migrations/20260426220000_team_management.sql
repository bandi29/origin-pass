-- Team management: RBAC, invitations, activity (extends organizations / users; no duplicate org model).

-- ---------------------------------------------------------------------------
-- Catalog: global permissions + default role → permission templates
-- ---------------------------------------------------------------------------
create table if not exists public.team_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null,
  category text not null default 'general',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.team_role_templates (
  role_slug text not null,
  permission_key text not null references public.team_permissions (key) on delete cascade,
  primary key (role_slug, permission_key)
);

create table if not exists public.team_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (organization_id, slug)
);

create index if not exists idx_team_roles_org on public.team_roles (organization_id);

create table if not exists public.team_role_permissions (
  role_id uuid not null references public.team_roles (id) on delete cascade,
  permission_key text not null references public.team_permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  team_role_id uuid not null references public.team_roles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended')),
  joined_at timestamptz not null default timezone('utc'::text, now()),
  last_seen_at timestamptz,
  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_org on public.organization_members (organization_id);
create index if not exists idx_organization_members_user on public.organization_members (user_id);

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  team_role_id uuid not null references public.team_roles (id) on delete restrict,
  token_hash text not null unique,
  invited_by uuid references public.users (id) on delete set null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists team_invitations_one_pending_per_email
  on public.team_invitations (organization_id, lower(email))
  where (status = 'pending');

create index if not exists idx_team_invitations_org on public.team_invitations (organization_id);
create index if not exists idx_team_invitations_status on public.team_invitations (status);

create table if not exists public.team_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_team_activity_logs_org_created
  on public.team_activity_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- organizations: enterprise fields (nullable / backfilled)
-- ---------------------------------------------------------------------------
alter table public.organizations add column if not exists slug text;
alter table public.organizations add column if not exists logo_url text;
alter table public.organizations add column if not exists owner_id uuid references public.users (id) on delete set null;
alter table public.organizations add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.organizations add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

create unique index if not exists organizations_slug_unique_lower
  on public.organizations (lower(slug))
  where slug is not null and length(trim(slug)) > 0;

-- ---------------------------------------------------------------------------
-- Seed permission catalog + templates (idempotent)
-- ---------------------------------------------------------------------------
insert into public.team_permissions (key, description, category) values
  ('products.read', 'View products and catalog data.', 'products'),
  ('products.create', 'Create products.', 'products'),
  ('products.edit', 'Edit products.', 'products'),
  ('products.delete', 'Delete products.', 'products'),
  ('passports.read', 'View product passports.', 'passports'),
  ('passports.manage', 'Create, edit, and publish passports.', 'passports'),
  ('qr.generate', 'Generate QR identities.', 'qr'),
  ('labels.print', 'Print labels and export print jobs.', 'labels'),
  ('analytics.view', 'View analytics and reporting.', 'analytics'),
  ('verification.view', 'Run read-only verification flows.', 'verification'),
  ('team.manage', 'Invite members, roles, and invitations.', 'team'),
  ('billing.manage', 'Manage billing and subscription.', 'billing'),
  ('api.manage', 'Create and revoke API keys.', 'api')
on conflict (key) do nothing;

-- Owner: full set
insert into public.team_role_templates (role_slug, permission_key)
select 'owner', key from public.team_permissions
on conflict (role_slug, permission_key) do nothing;

-- Admin: all except billing
insert into public.team_role_templates (role_slug, permission_key)
select 'admin', key from public.team_permissions where key <> 'billing.manage'
on conflict (role_slug, permission_key) do nothing;

-- Editor
insert into public.team_role_templates (role_slug, permission_key) values
  ('editor', 'products.create'),
  ('editor', 'products.edit'),
  ('editor', 'passports.manage'),
  ('editor', 'qr.generate'),
  ('editor', 'labels.print'),
  ('editor', 'products.read'),
  ('editor', 'passports.read')
on conflict (role_slug, permission_key) do nothing;

-- Viewer
insert into public.team_role_templates (role_slug, permission_key) values
  ('viewer', 'products.read'),
  ('viewer', 'passports.read'),
  ('viewer', 'verification.view'),
  ('viewer', 'analytics.view')
on conflict (role_slug, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Per-organization system roles + role permissions from templates
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.organizations
  loop
    insert into public.team_roles (organization_id, slug, name, description, is_system) values
      (r.id, 'owner', 'Owner', 'Full organization access including billing.', true),
      (r.id, 'admin', 'Admin', 'Manage team, products, passports, and operations.', true),
      (r.id, 'editor', 'Editor', 'Create catalog data, passports, QR identities, and labels.', true),
      (r.id, 'viewer', 'Viewer', 'Read-only verification and analytics.', true)
    on conflict (organization_id, slug) do nothing;

    insert into public.team_role_permissions (role_id, permission_key)
    select tr.id, tpl.permission_key
    from public.team_roles tr
    inner join public.team_role_templates tpl on tpl.role_slug = tr.slug
    where tr.organization_id = r.id
    on conflict (role_id, permission_key) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Backfill organizations.slug / owner_id
-- ---------------------------------------------------------------------------
update public.organizations o
set owner_id = sub.uid
from (
  select distinct on (organization_id) organization_id, id as uid
  from public.users
  where organization_id is not null
  order by organization_id, created_at asc
) sub
where o.id = sub.organization_id
  and o.owner_id is null;

update public.organizations
set slug = 'org-' || replace(id::text, '-', '')
where slug is null or length(trim(slug)) = 0;

-- ---------------------------------------------------------------------------
-- Backfill organization_members from public.users
-- ---------------------------------------------------------------------------
insert into public.organization_members (organization_id, user_id, team_role_id, status, joined_at)
select
  u.organization_id,
  u.id,
  tr.id,
  'active',
  u.created_at
from public.users u
inner join public.team_roles tr
  on tr.organization_id = u.organization_id
 and tr.slug = (
    case
      when u.id = (
        select u2.id
        from public.users u2
        where u2.organization_id = u.organization_id
        order by u2.created_at asc
        limit 1
      ) then 'owner'
      when coalesce(
        u.role_v2::text,
        case when u.role = 'owner' then 'tenant_admin' else u.role end,
        'viewer'
      ) in ('super_admin', 'tenant_admin') then 'admin'
      when coalesce(
        u.role_v2::text,
        case when u.role = 'owner' then 'tenant_admin' else u.role end,
        'viewer'
      ) in ('compliance_manager', 'fraud_analyst') then 'admin'
      when coalesce(
        u.role_v2::text,
        case when u.role = 'owner' then 'tenant_admin' else u.role end,
        'viewer'
      ) = 'supplier' then 'editor'
      when coalesce(
        u.role_v2::text,
        case when u.role = 'owner' then 'tenant_admin' else u.role end,
        'viewer'
      ) = 'viewer' then 'viewer'
      else 'viewer'
    end
  )
where u.organization_id is not null
on conflict (organization_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS (read paths for authenticated org members; writes via service role APIs)
-- ---------------------------------------------------------------------------
alter table public.team_permissions enable row level security;
alter table public.team_roles enable row level security;
alter table public.team_role_permissions enable row level security;
alter table public.organization_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_activity_logs enable row level security;

drop policy if exists "team_permissions_select_authenticated" on public.team_permissions;
create policy "team_permissions_select_authenticated" on public.team_permissions
  for select to authenticated
  using (true);

drop policy if exists "team_roles_select_org" on public.team_roles;
create policy "team_roles_select_org" on public.team_roles
  for select to authenticated
  using (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "team_role_permissions_select_org" on public.team_role_permissions;
create policy "team_role_permissions_select_org" on public.team_role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.team_roles tr
      where tr.id = team_role_permissions.role_id
        and tr.organization_id = public.originpass_auth_user_organization_id()
    )
  );

drop policy if exists "organization_members_select_org" on public.organization_members;
create policy "organization_members_select_org" on public.organization_members
  for select to authenticated
  using (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "team_invitations_select_org" on public.team_invitations;
create policy "team_invitations_select_org" on public.team_invitations
  for select to authenticated
  using (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "team_activity_logs_select_org" on public.team_activity_logs;
create policy "team_activity_logs_select_org" on public.team_activity_logs
  for select to authenticated
  using (organization_id = public.originpass_auth_user_organization_id());

grant select on public.team_permissions to authenticated;
grant select on public.team_roles to authenticated;
grant select on public.team_role_permissions to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.team_invitations to authenticated;
grant select on public.team_activity_logs to authenticated;
