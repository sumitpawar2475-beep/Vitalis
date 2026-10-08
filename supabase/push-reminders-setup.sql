-- VITALIS web-push reminders.
-- First create these three secrets in Supabase Dashboard > Database > Vault:
--   vitalis_project_url        = your https://<project-ref>.supabase.co URL
--   vitalis_publishable_key    = the publishable key already used by js/app.js
--   vitalis_push_cron_secret   = the same random secret set as the Edge Function secret
-- Then run this script in the Supabase SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  subscription_json jsonb not null,
  time_zone text not null default 'UTC',
  last_sent_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'vitalis-hydration-reminders';

select cron.schedule(
  'vitalis-hydration-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'vitalis_project_url')
      || '/functions/v1/send-hydration-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'vitalis_publishable_key'),
      'x-vitalis-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vitalis_push_cron_secret')
    ),
    body := jsonb_build_object('scheduled_at', now())
  ) as request_id;
  $$
);
