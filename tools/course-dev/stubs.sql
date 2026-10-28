-- Local test mode only. NOT a migration: stand-ins for what Supabase and the existing
-- /app setup provide, so supabase/migrations/*.sql can run on a plain local Postgres.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
grant usage on schema public, auth, storage to anon, authenticated;

create table if not exists auth.users (id uuid primary key, email text);
create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), status text);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

-- The existing /app pieces the course reads
create table if not exists public.members (user_id uuid primary key references auth.users(id), name text, email text, company_id int, active boolean default true, access text[] default '{}', created_at timestamptz default now());
create table if not exists public.tracker_admins (user_id uuid primary key);
create or replace function public.is_tracker_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.tracker_admins where user_id = auth.uid()) $$;
grant execute on function public.is_tracker_admin() to authenticated;
