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


-- Searchable, opt-in community identities. No health or activity data is stored here.
create table if not exists public.community_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 2 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_path text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists community_profiles_username_lower_unique
  on public.community_profiles (lower(username));

alter table public.community_profiles enable row level security;

drop policy if exists "Community members can view discoverable profiles" on public.community_profiles;
create policy "Community members can view discoverable profiles"
  on public.community_profiles for select to authenticated
  using (is_public or (select auth.uid()) = user_id);

drop policy if exists "Users can create their own community profile" on public.community_profiles;
create policy "Users can create their own community profile"
  on public.community_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own community profile" on public.community_profiles;
create policy "Users can update their own community profile"
  on public.community_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.community_profiles to authenticated;

create table if not exists public.community_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  photo_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists community_photos_user_created_idx
  on public.community_photos (user_id, created_at desc);

alter table public.community_photos enable row level security;

drop policy if exists "Members can view photos from discoverable profiles" on public.community_photos;
create policy "Members can view photos from discoverable profiles"
  on public.community_photos for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.community_profiles p
      where p.user_id = community_photos.user_id and p.is_public
    )
  );

drop policy if exists "Users can add their own community photos" on public.community_photos;
create policy "Users can add their own community photos"
  on public.community_photos for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own community photos" on public.community_photos;
create policy "Users can delete their own community photos"
  on public.community_photos for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.community_photos to authenticated;

-- Enforce the photo-grid limit in the database as well as the interface.
create or replace function public.enforce_community_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.community_photos where user_id = new.user_id) >= 12 then
    raise exception 'A community profile can contain at most 12 photos.';
  end if;
  return new;
end;
$$;

drop trigger if exists community_photos_limit on public.community_photos;
create trigger community_photos_limit
  before insert on public.community_photos
  for each row execute function public.enforce_community_photo_limit();

-- Private storage: public photos can be signed only when the member profile is discoverable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can view permitted community media" on storage.objects;
create policy "Members can view permitted community media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'community-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.community_profiles p
        where p.user_id::text = (storage.foldername(name))[1] and p.is_public
      )
    )
  );

drop policy if exists "Users can upload their own community media" on storage.objects;
create policy "Users can upload their own community media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own community media" on storage.objects;
create policy "Users can delete their own community media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
