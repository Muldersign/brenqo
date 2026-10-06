-- Row level security checks. Run after supabase-stub.sql and the migration.
-- Every block raises an exception when an expectation fails.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'glenn@muldersign.nl', '{"name":"Glenn"}'),
  ('00000000-0000-0000-0000-00000000000b', 'penningmeester@vz.nl', '{"name":"Femke"}'),
  ('00000000-0000-0000-0000-00000000000c', 'boekhouder@kantoor.nl', '{}');

-- Glenn creates Muldersign, Femke creates V&Z.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into organizations (id, data) values ('org_ms', '{"name":"Muldersign","inboxAddress":"muldersign-7K2F@inbox.brenqo.nl"}');
insert into invoices (id, organization_id, data) values ('inv_1', 'org_ms', '{"number":"2026-001","publicToken":"TOKENA","state":"sent"}');
insert into customers (id, organization_id, data) values ('cus_1', 'org_ms', '{"companyName":"De Leo Media"}');
insert into organization_invites (organization_id, email, role) values ('org_ms', 'boekhouder@kantoor.nl', 'viewer');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into organizations (id, data) values ('org_vz', '{"name":"V&Z","inboxAddress":"vz-Q8MD@inbox.brenqo.nl"}');
insert into invoices (id, organization_id, data) values ('inv_2', 'org_vz', '{"number":"VZ-2026-001","publicToken":"TOKENB","state":"open"}');

do $$ begin
  -- Femke sees only V&Z.
  if (select count(*) from organizations) <> 1 then raise exception 'Femke sees % organizations', (select count(*) from organizations); end if;
  if exists (select 1 from invoices where organization_id = 'org_ms') then raise exception 'Femke can read Muldersign invoices'; end if;
  if exists (select 1 from customers) then raise exception 'Femke can read Muldersign customers'; end if;
end $$;

-- Femke cannot write into Muldersign.
do $$ begin
  begin
    insert into customers (id, organization_id, data) values ('cus_x', 'org_ms', '{}');
    raise exception 'Femke could insert into Muldersign';
  exception when insufficient_privilege then null;
  end;
  update invoices set data = data || '{"state":"paid"}' where id = 'inv_1';
  if found then raise exception 'Femke could update a Muldersign invoice'; end if;
end $$;

-- Secrets are invisible to every signed-in user.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if exists (select 1 from organization_secrets) then raise exception 'secrets readable'; end if;
  begin
    insert into organization_secrets (organization_id, mollie_api_key) values ('org_ms', 'live_x');
    raise exception 'secrets writable by user';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Invoice numbers are unique per administration; the same number in another one is fine.
do $$ begin
  begin
    insert into invoices (id, organization_id, data) values ('inv_dup', 'org_ms', '{"number":"2026-001","publicToken":"TOKENC"}');
    raise exception 'duplicate invoice number accepted';
  exception when unique_violation then null;
  end;
  insert into invoices (id, organization_id, data) values ('inv_draft1', 'org_ms', '{"number":"","publicToken":"TOKEND"}');
  insert into invoices (id, organization_id, data) values ('inv_draft2', 'org_ms', '{"number":"","publicToken":"TOKENE"}');
end $$;

-- Storage: own folder yes, other administration's folder no.
do $$ begin
  insert into storage.objects (bucket_id, name) values ('documents', 'org_ms/bon.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('documents', 'org_vz/bon.jpg');
    raise exception 'upload into another administration accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The invited bookkeeper signs in, accepts, and can read but not write.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if (select public.accept_invites()) <> 1 then raise exception 'invite not accepted'; end if;
  if (select count(*) from invoices) <> 3 then raise exception 'viewer sees % invoices', (select count(*) from invoices); end if;
  update invoices set data = data || '{"state":"paid"}' where id = 'inv_1';
  if found then raise exception 'viewer could update'; end if;
end $$;

-- The service role (webhooks, cron) sees everything.
reset role;
set role service_role;
do $$ begin
  if (select count(*) from invoices) <> 4 then raise exception 'service role sees % invoices', (select count(*) from invoices); end if;
  if (select id from organizations where inbox_address = 'muldersign-7k2f@inbox.brenqo.nl') <> 'org_ms' then raise exception 'inbox lookup failed'; end if;
  if (select id from invoices where public_token = 'TOKENB') <> 'inv_2' then raise exception 'token lookup failed'; end if;
end $$;
reset role;
select 'RLS OK' as result;
