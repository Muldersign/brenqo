-- Brenqo — database schema
-- Every table that holds administration data carries organization_id.
-- Row level security guarantees a user only ever sees administrations
-- (organizations) they are a member of. Server-side jobs (webhooks,
-- inbound mail) use the service role and must scope explicitly.

create extension if not exists pgcrypto;

-- ───────────────────────── Users & administrations ─────────────────────────

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'business' check (kind in ('business', 'association')),
  name text not null,
  trade_name text not null default '',
  logo_path text,
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  country text not null default 'Nederland',
  kvk text not null default '',
  vat_number text not null default '',
  vat_registered boolean not null default true,
  iban text not null default '',
  bic text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  accent_color text not null default '#5B4BF5',
  inbox_address text not null unique,
  created_at timestamptz not null default now()
);

create table public.organization_users (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- One row per administration; JSON blocks keep simple toggles simple.
create table public.settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  invoice_prefix text not null default to_char(now(), 'YYYY') || '-',
  next_invoice_number integer not null default 1 check (next_invoice_number > 0),
  quote_prefix text not null default 'OF-' || to_char(now(), 'YYYY') || '-',
  next_quote_number integer not null default 1 check (next_quote_number > 0),
  payment_term_days integer not null default 14,
  quote_valid_days integer not null default 30,
  default_vat_rate smallint not null default 21 check (default_vat_rate in (0, 9, 21)),
  default_invoice_note text not null default '',
  invoice_email_subject text not null default '',
  invoice_email_body text not null default '',
  quote_email_subject text not null default '',
  quote_email_body text not null default '',
  reminders jsonb not null default '{"enabled": true, "steps": []}',
  payments jsonb not null default '{"provider": "none", "connected": false}',
  automations jsonb not null default '{}',
  mollie_profile_id text,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Relations & catalogue ─────────────────────────

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  company_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  postal_code text not null default '',
  city text not null default '',
  country text not null default 'Nederland',
  kvk text not null default '',
  vat_number text not null default '',
  iban text not null default '',
  payment_term_days integer not null default 14,
  default_invoice_text text not null default '',
  reminders_enabled boolean not null default true,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.customers (organization_id, company_name);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  default_category text not null default 'Overig',  -- learned: "Adobe → Software"
  default_vat_rate smallint not null default 21,
  iban text not null default '',
  email text not null default '',
  website text not null default '',
  times_used integer not null default 0,
  unique (organization_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null default 0,
  vat_rate smallint not null default 21 check (vat_rate in (0, 9, 21)),
  unit text not null default 'stuk'
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  icon text not null default 'tag',
  custom boolean not null default false,
  unique (organization_id, name)
);

-- ───────────────────────── Sales ─────────────────────────

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  number text not null,
  issue_date date not null,
  valid_until date not null,
  reference text not null default '',
  note text not null default '',
  state text not null default 'draft' check (state in ('draft', 'sent', 'accepted', 'declined')),
  public_token text not null unique,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  position smallint not null default 0,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'stuk',
  unit_price numeric(12, 2) not null default 0,
  vat_rate smallint not null default 21,
  discount_pct numeric(5, 2) not null default 0
);

create table public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  name text not null,
  lines jsonb not null default '[]',
  frequency text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  start_date date not null,
  next_date date not null,
  end_date date,
  auto_create boolean not null default true,
  auto_send boolean not null default false,
  active boolean not null default true
);
create index on public.recurring_invoices (next_date) where active;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null default 'invoice' check (kind in ('invoice', 'credit')),
  number text,                      -- assigned when finalised; drafts have none
  customer_id uuid not null references public.customers (id),
  issue_date date not null,
  due_date date not null,
  reference text not null default '',
  note text not null default '',
  state text not null default 'draft' check (state in ('draft', 'open', 'sent', 'viewed', 'paid', 'partial', 'credited')),
  public_token text not null unique,
  subtotal numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at date,
  credit_of_id uuid references public.invoices (id),
  quote_id uuid references public.quotes (id),
  recurring_id uuid references public.recurring_invoices (id),
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, number)
);
create index on public.invoices (organization_id, state, due_date);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position smallint not null default 0,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit text not null default 'stuk',
  unit_price numeric(12, 2) not null default 0,
  vat_rate smallint not null default 21,
  discount_pct numeric(5, 2) not null default 0
);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  paid_on date not null,
  amount numeric(12, 2) not null,
  method text not null default 'bank',
  source text not null default 'manual' check (source in ('manual', 'bank', 'online')),
  note text not null default '',
  provider_payment_id text unique,  -- Mollie tr_… ; makes webhooks idempotent
  transaction_id uuid,
  created_at timestamptz not null default now()
);

create table public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  step_id text not null,
  sent_at timestamptz not null default now(),
  unique (invoice_id, step_id)
);

-- ───────────────────────── Purchases ─────────────────────────

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path text not null,       -- Supabase Storage bucket "documents", prefixed with organization_id
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null default 'receipt' check (kind in ('receipt', 'invoice')),
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text not null,
  invoice_number text not null default '',
  date date not null,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  vat_rate smallint not null default 21,
  category text not null default 'Overig',
  description text not null default '',
  iban text not null default '',
  status text not null default 'review' check (status in ('review', 'processed')),
  paid boolean not null default true,
  source text not null default 'upload' check (source in ('camera', 'upload', 'email')),
  document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.expenses (organization_id, date);

-- Several documents per expense (e.g. receipt photo + PDF).
create table public.expense_documents (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  primary key (expense_id, document_id)
);

-- ───────────────────────── Bank ─────────────────────────

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  bank_name text not null,
  name text not null,
  iban text not null,
  balance numeric(14, 2) not null default 0,
  provider text not null default 'psd2',
  provider_account_id text,         -- id at the PSD2 aggregator
  consent_valid_until date,
  last_sync_at timestamptz,
  unique (organization_id, iban)
);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.bank_accounts (id) on delete cascade,
  provider_transaction_id text,
  date date not null,
  description text not null default '',
  counterparty text not null default '',
  counterparty_iban text not null default '',
  amount numeric(14, 2) not null,
  status text not null default 'todo' check (status in ('todo', 'suggested', 'matched', 'categorized', 'ignored')),
  category text,
  unique (account_id, provider_transaction_id)
);
create index on public.bank_transactions (organization_id, status);

create table public.transaction_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transaction_id uuid not null references public.bank_transactions (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete cascade,
  confidence smallint not null default 0,
  confirmed boolean not null default false,
  auto boolean not null default false,
  created_at timestamptz not null default now(),
  check ((invoice_id is null) <> (expense_id is null))
);

-- ───────────────────────── Communication ─────────────────────────

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('invoice', 'reminder', 'quote')),
  invoice_id uuid references public.invoices (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  to_address text not null,
  subject text not null,
  body text not null,
  provider_message_id text,
  sent_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (organization_id, created_at desc);

-- ───────────────────────── Row level security ─────────────────────────

create or replace function public.is_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_users where organization_id = org and user_id = auth.uid());
$$;

create or replace function public.can_write(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_users where organization_id = org and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

alter table public.users enable row level security;
create policy "own profile" on public.users for all using (id = auth.uid()) with check (id = auth.uid());

alter table public.organizations enable row level security;
create policy "members read" on public.organizations for select using (public.is_member(id));
create policy "admins update" on public.organizations for update using (public.can_write(id));
create policy "anyone creates" on public.organizations for insert with check (auth.uid() is not null);

alter table public.organization_users enable row level security;
create policy "members read" on public.organization_users for select using (public.is_member(organization_id));
create policy "admins manage" on public.organization_users for all using (public.can_write(organization_id)) with check (public.can_write(organization_id));

-- Same two policies on every organization-scoped table.
do $$
declare t text;
begin
  foreach t in array array[
    'settings', 'customers', 'suppliers', 'products', 'categories', 'quotes', 'quote_lines', 'recurring_invoices',
    'invoices', 'invoice_lines', 'invoice_payments', 'payment_reminders', 'documents', 'expenses', 'expense_documents',
    'bank_accounts', 'bank_transactions', 'transaction_matches', 'email_logs', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select using (public.is_member(organization_id))', t);
    execute format('create policy "admins write" on public.%I for all using (public.can_write(organization_id)) with check (public.can_write(organization_id))', t);
  end loop;
end $$;

-- Whoever creates an administration becomes its owner.
create or replace function public.on_organization_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into organization_users (organization_id, user_id, role) values (new.id, auth.uid(), 'owner');
  end if;
  insert into settings (organization_id) values (new.id);
  return new;
end $$;
create trigger organization_created after insert on public.organizations for each row execute function public.on_organization_created();

-- ───────────────────────── Business rules in the database ─────────────────────────

-- Gapless numbering per administration: lock the settings row while assigning.
create or replace function public.finalize_invoice(p_invoice_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare v_org uuid; v_number text; v_prefix text; v_next integer;
begin
  select organization_id, number into v_org, v_number from invoices where id = p_invoice_id for update;
  if v_number is not null then return v_number; end if;
  select invoice_prefix, next_invoice_number into v_prefix, v_next from settings where organization_id = v_org for update;
  v_number := v_prefix || lpad(v_next::text, 3, '0');
  update settings set next_invoice_number = v_next + 1 where organization_id = v_org;
  update invoices set number = v_number, state = 'open' where id = p_invoice_id;
  return v_number;
end $$;

-- Store a payment and update the invoice in one transaction. Idempotent on provider_payment_id.
create or replace function public.record_invoice_payment(
  p_invoice_id uuid, p_organization_id uuid, p_amount numeric, p_paid_at date, p_method text, p_source text, p_provider_payment_id text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_total numeric; v_paid numeric; v_number text;
begin
  insert into invoice_payments (organization_id, invoice_id, paid_on, amount, method, source, provider_payment_id)
  values (p_organization_id, p_invoice_id, p_paid_at, p_amount, p_method, p_source, p_provider_payment_id)
  on conflict (provider_payment_id) do nothing;
  if not found then return; end if;

  select total, number into v_total, v_number from invoices where id = p_invoice_id and organization_id = p_organization_id;
  select coalesce(sum(amount), 0) into v_paid from invoice_payments where invoice_id = p_invoice_id;
  update invoices
     set state = case when v_paid >= v_total then 'paid' else 'partial' end,
         paid_at = case when v_paid >= v_total then p_paid_at else paid_at end
   where id = p_invoice_id;
  if v_paid >= v_total then
    insert into notifications (organization_id, kind, title, href)
    values (p_organization_id, 'paid', 'Factuur ' || v_number || ' is betaald.', '/facturen/' || p_invoice_id);
  end if;
end $$;

-- Public invoice page: read one invoice by its unguessable token, without login.
create or replace function public.public_invoice(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'invoice', to_json(i), 'lines', (select json_agg(l order by l.position) from invoice_lines l where l.invoice_id = i.id),
    'organization', json_build_object('name', o.name, 'trade_name', o.trade_name, 'logo_path', o.logo_path, 'iban', o.iban, 'email', o.email, 'phone', o.phone, 'accent_color', o.accent_color, 'address', o.address, 'postal_code', o.postal_code, 'city', o.city, 'kvk', o.kvk, 'vat_number', o.vat_number),
    'customer', (select json_build_object('company_name', c.company_name, 'contact_name', c.contact_name, 'address', c.address, 'postal_code', c.postal_code, 'city', c.city) from customers c where c.id = i.customer_id)
  )
  from invoices i join organizations o on o.id = i.organization_id
  where i.public_token = p_token and i.state <> 'draft';
$$;
grant execute on function public.public_invoice(text) to anon;

-- Storage: documents/<organization_id>/... readable only by members.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing;
create policy "members read documents" on storage.objects for select using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "admins write documents" on storage.objects for insert with check (bucket_id = 'documents' and public.can_write(((storage.foldername(name))[1])::uuid));
