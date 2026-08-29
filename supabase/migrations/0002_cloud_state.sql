-- 0002: whole-account cloud state sync (V2.0)
-- The app keeps one JSONB snapshot per cloud account, mirroring the local
-- LocalAppRepository state. Normalized tables from 0001 remain for the future
-- multi-user community phase; this table is the MVP sync channel.

create table if not exists public.app_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app state owner read" on public.app_state;
drop policy if exists "app state owner insert" on public.app_state;
drop policy if exists "app state owner update" on public.app_state;
drop policy if exists "app state owner delete" on public.app_state;

create policy "app state owner read" on public.app_state
  for select to authenticated using (auth.uid() = user_id);

create policy "app state owner insert" on public.app_state
  for insert to authenticated with check (auth.uid() = user_id);

create policy "app state owner update" on public.app_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "app state owner delete" on public.app_state
  for delete to authenticated using (auth.uid() = user_id);
