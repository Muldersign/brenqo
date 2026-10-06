-- Brenqo database
--
-- Every record is stored as a JSON document (`data`) in the exact shape the
-- app uses (src/lib/types.ts), next to `organization_id`. Browser and server
-- therefore share one data model and one set of business rules
-- (src/lib/domain, src/lib/store/core.ts). Columns that need indexes or
-- uniqueness (public tokens, invoice numbers, inbox address) are generated
-- from the document.
--
-- Separation between administrations is enforced by row level security:
-- a signed-in user only sees organizations they are a member of.

-- ───────────────────────── Administrations & members ─────────────────────────

create table public.organizations (
  id text primary key,
  data jsonb not null,
  inbox_address text generated always as (lower(data ->> 'inboxAddress')) stored unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id text not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'viewer')),
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on public.organization_members (user_id);

-- Invited by e-mail; becomes a membership when that person signs in.
create table public.organization_invites (
  organization_id text not null references public.organizations (id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'admin' check (role in ('admin', 'viewer')),
  invited_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (organization_id, email)
);

-- Server-only secrets per administration (e.g. its own Mollie API key).
-- RLS on, no policies: only the service role can read or write.
create table public.organization_secrets (
  organization_id text primary key references public.organizations (id) on delete cascade,
  mollie_api_key text,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Administration data ─────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'customers', 'suppliers', 'products', 'categories', 'invoices', 'quotes', 'recurring_invoices',
    'expenses', 'bank_accounts', 'bank_transactions', 'notifications', 'email_logs'
  ] loop
    execute format($f$
      create table public.%1$I (
        id text primary key,
        organization_id text not null references public.organizations (id) on delete cascade,
        data jsonb not null,
        updated_at timestamptz not null default now()
      );
      create index on public.%1$I (organization_id);
    $f$, t);
  end loop;
end $$;

alter table public.invoices
  add column public_token text generated always as (data ->> 'publicToken') stored,
  add column number text generated always as (nullif(data ->> 'number', '')) stored,
  add column state text generated always as (data ->> 'state') stored;
create unique index invoices_public_token on public.invoices (public_token);
-- Gapless, unique numbering per administration.
create unique index invoices_number on public.invoices (organization_id, number) where number is not null;

alter table public.quotes add column public_token text generated always as (data ->> 'publicToken') stored;
create unique index quotes_public_token on public.quotes (public_token);

alter table public.bank_transactions add column external_id text generated always as (data ->> 'externalId') stored;
create unique index bank_transactions_external on public.bank_transactions (organization_id, external_id) where external_id is not null;

-- ───────────────────────── Access rules ─────────────────────────

create or replace function public.is_member(org text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where organization_id = org and user_id = auth.uid());
$$;

create or replace function public.can_write(org text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where organization_id = org and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

alter table public.organizations enable row level security;
create policy "members read" on public.organizations for select using (public.is_member(id) or created_by = auth.uid());
create policy "signed-in users create" on public.organizations for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy "admins update" on public.organizations for update using (public.can_write(id)) with check (public.can_write(id));
create policy "owners delete" on public.organizations for delete using (
  exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.user_id = auth.uid() and m.role = 'owner')
);

alter table public.organization_members enable row level security;
create policy "members read" on public.organization_members for select using (public.is_member(organization_id));
create policy "admins manage" on public.organization_members for all using (public.can_write(organization_id)) with check (public.can_write(organization_id));

alter table public.organization_invites enable row level security;
create policy "members read" on public.organization_invites for select using (public.is_member(organization_id));
create policy "admins manage" on public.organization_invites for all using (public.can_write(organization_id)) with check (public.can_write(organization_id));

alter table public.organization_secrets enable row level security;

alter table public.push_subscriptions enable row level security;
create policy "own subscriptions" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'customers', 'suppliers', 'products', 'categories', 'invoices', 'quotes', 'recurring_invoices',
    'expenses', 'bank_accounts', 'bank_transactions', 'notifications', 'email_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select using (public.is_member(organization_id))', t);
    execute format('create policy "admins insert" on public.%I for insert with check (public.can_write(organization_id))', t);
    execute format('create policy "admins update" on public.%I for update using (public.can_write(organization_id)) with check (public.can_write(organization_id))', t);
    execute format('create policy "admins delete" on public.%I for delete using (public.can_write(organization_id))', t);
  end loop;
end $$;

-- ───────────────────────── Triggers & functions ─────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'customers', 'suppliers', 'products', 'categories', 'invoices', 'quotes', 'recurring_invoices',
    'expenses', 'bank_accounts', 'bank_transactions', 'notifications', 'email_logs'
  ] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Whoever creates an administration becomes its owner.
create or replace function public.on_organization_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_name text;
begin
  if auth.uid() is not null then
    select email, coalesce(raw_user_meta_data ->> 'name', '') into v_email, v_name from auth.users where id = auth.uid();
    insert into organization_members (organization_id, user_id, role, name, email)
    values (new.id, auth.uid(), 'owner', coalesce(v_name, ''), coalesce(v_email, ''))
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger organization_created after insert on public.organizations for each row execute function public.on_organization_created();

-- Called after sign-in: turn pending invites for this e-mail address into memberships.
create or replace function public.accept_invites()
returns integer language plpgsql security definer set search_path = public as $$
declare v_email text; v_name text; v_count integer;
begin
  select lower(email), coalesce(raw_user_meta_data ->> 'name', '') into v_email, v_name from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  insert into organization_members (organization_id, user_id, role, name, email)
  select organization_id, auth.uid(), role, coalesce(nullif(v_name, ''), name), v_email from organization_invites where lower(email) = v_email
  on conflict do nothing;
  get diagnostics v_count = row_count;
  delete from organization_invites where lower(email) = v_email;
  return v_count;
end $$;
grant execute on function public.accept_invites() to authenticated;

-- ───────────────────────── Files ─────────────────────────
-- Receipts and purchase invoices: bucket "documents", path <organization_id>/<file>.

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing;
create policy "members read documents" on storage.objects for select
  using (bucket_id = 'documents' and public.is_member((storage.foldername(name))[1]));
create policy "admins upload documents" on storage.objects for insert
  with check (bucket_id = 'documents' and public.can_write((storage.foldername(name))[1]));
create policy "admins delete documents" on storage.objects for delete
  using (bucket_id = 'documents' and public.can_write((storage.foldername(name))[1]));

-- ───────────────────────── Bank connections (PSD2) ─────────────────────────
-- Pending and active consents at the Open Banking provider. Server-only.

create table public.bank_connections (
  requisition_id text primary key,
  organization_id text not null references public.organizations (id) on delete cascade,
  reference text not null unique,
  institution_id text not null,
  status text not null default 'pending',
  valid_until date,
  created_at timestamptz not null default now()
);
alter table public.bank_connections enable row level security;
