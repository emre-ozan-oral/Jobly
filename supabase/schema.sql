-- Jobly database schema.
-- Run this once in your Supabase project's SQL Editor
-- (https://supabase.com/dashboard/project/_/sql/new) after creating the
-- project. Safe to re-run - every statement is idempotent.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null,
  title text not null,
  url text not null,
  source text not null default 'manual',
  location text,
  applied_date date not null default current_date,
  status text not null default 'applied'
    check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
  notes text,
  salary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per (user, url): capturing the same posting twice updates it
-- instead of creating a duplicate, scoped per user.
create unique index if not exists jobs_user_url_key on public.jobs (user_id, url);
create index if not exists jobs_user_status_idx on public.jobs (user_id, status);
create index if not exists jobs_user_applied_date_idx on public.jobs (user_id, applied_date desc);

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_own" on public.jobs;
create policy "jobs_select_own" on public.jobs
  for select using (auth.uid() = user_id);

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own" on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own" on public.jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "jobs_delete_own" on public.jobs;
create policy "jobs_delete_own" on public.jobs
  for delete using (auth.uid() = user_id);

-- keep updated_at current on every UPDATE
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- api_tokens
-- One personal token per user, used by the browser extension to
-- authenticate capture requests (it has no login UI of its own - it
-- just sends this token as a bearer credential).
-- ---------------------------------------------------------------------
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.api_tokens enable row level security;

drop policy if exists "api_tokens_select_own" on public.api_tokens;
create policy "api_tokens_select_own" on public.api_tokens
  for select using (auth.uid() = user_id);

-- Inserts/updates/deletes on api_tokens only ever happen through
-- /api/tokens using the service-role key (so a user can't mint a token
-- for someone else's account by forging a request) - no client-facing
-- write policies are needed.
