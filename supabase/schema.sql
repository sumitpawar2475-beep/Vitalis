-- VITALIS private account state.
-- Each authenticated user can access only the row whose user_id matches auth.uid().
create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

-- Re-runnable policy setup.
drop policy if exists "Users can read their own VITALIS state" on public.user_app_state;
drop policy if exists "Users can create their own VITALIS state" on public.user_app_state;
drop policy if exists "Users can update their own VITALIS state" on public.user_app_state;
drop policy if exists "Users can delete their own VITALIS state" on public.user_app_state;

create policy "Users can read their own VITALIS state"
  on public.user_app_state for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own VITALIS state"
  on public.user_app_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own VITALIS state"
  on public.user_app_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own VITALIS state"
  on public.user_app_state for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_app_state to authenticated;
