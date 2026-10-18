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

-- Adults-only community beta. The app's saved age is used as a self-reported gate;
-- this is not identity or age verification.
create or replace function public.is_community_adult()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
      when (s.state #>> '{profile,age}') ~ '^[0-9]{1,3}$'
        then ((s.state #>> '{profile,age}')::integer >= 18)
      else false
    end
    from public.user_app_state s
    where s.user_id = (select auth.uid())
  ), false);
$$;

revoke all on function public.is_community_adult() from public;
grant execute on function public.is_community_adult() to authenticated;

-- Re-apply the community-profile and storage gates for the adults-only beta.
drop policy if exists "Community members can view discoverable profiles" on public.community_profiles;
create policy "Community members can view discoverable profiles"
  on public.community_profiles for select to authenticated
  using (public.is_community_adult() and (is_public or (select auth.uid()) = user_id));

drop policy if exists "Users can create their own community profile" on public.community_profiles;
create policy "Users can create their own community profile"
  on public.community_profiles for insert to authenticated
  with check (public.is_community_adult() and (select auth.uid()) = user_id);

drop policy if exists "Users can update their own community profile" on public.community_profiles;
create policy "Users can update their own community profile"
  on public.community_profiles for update to authenticated
  using (public.is_community_adult() and (select auth.uid()) = user_id)
  with check (public.is_community_adult() and (select auth.uid()) = user_id);

drop policy if exists "Members can view photos from discoverable profiles" on public.community_photos;
create policy "Members can view photos from discoverable profiles"
  on public.community_photos for select to authenticated
  using (
    public.is_community_adult()
    and (
      (select auth.uid()) = user_id
      or exists (
        select 1 from public.community_profiles p
        where p.user_id = community_photos.user_id and p.is_public
      )
    )
  );

drop policy if exists "Users can add their own community photos" on public.community_photos;
create policy "Users can add their own community photos"
  on public.community_photos for insert to authenticated
  with check (public.is_community_adult() and (select auth.uid()) = user_id);

drop policy if exists "Users can delete their own community photos" on public.community_photos;
create policy "Users can delete their own community photos"
  on public.community_photos for delete to authenticated
  using (public.is_community_adult() and (select auth.uid()) = user_id);

drop policy if exists "Members can view permitted community media" on storage.objects;
create policy "Members can view permitted community media"
  on storage.objects for select to authenticated
  using (
    public.is_community_adult()
    and bucket_id = 'community-media'
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
    public.is_community_adult()
    and bucket_id = 'community-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own community media" on storage.objects;
create policy "Users can delete their own community media"
  on storage.objects for delete to authenticated
  using (
    public.is_community_adult()
    and bucket_id = 'community-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Activity communities hold their own access-controlled data, separate from wellness state.
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.community_profiles(user_id) on delete cascade,
  name text not null check (char_length(trim(name)) between 3 and 60),
  activity_type text not null check (char_length(activity_type) between 2 and 40),
  level text not null default 'All levels' check (char_length(level) <= 40),
  description text not null check (char_length(trim(description)) between 10 and 500),
  visibility text not null default 'public' check (visibility in ('public', 'private', 'invite_only')),
  schedule text not null default '' check (char_length(schedule) <= 120),
  meeting_area text not null default '' check (char_length(meeting_area) <= 120),
  rules text not null check (char_length(trim(rules)) between 10 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communities_visibility_created_idx
  on public.communities (visibility, created_at desc);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'pending', 'invited')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists community_members_user_status_idx
  on public.community_members (user_id, status, joined_at desc);

create or replace function public.is_community_moderator(community_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = community_id_input
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'moderator')
  );
$$;

revoke all on function public.is_community_moderator(uuid) from public;
grant execute on function public.is_community_moderator(uuid) to authenticated;

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

drop policy if exists "Adults can discover eligible communities" on public.communities;
create policy "Adults can discover eligible communities"
  on public.communities for select to authenticated
  using (
    public.is_community_adult()
    and (
      visibility in ('public', 'private')
      or exists (
        select 1 from public.community_members m
        where m.community_id = communities.id
          and m.user_id = (select auth.uid())
          and m.status in ('active', 'pending', 'invited')
      )
    )
  );

drop policy if exists "Adults can create communities from their profile" on public.communities;
create policy "Adults can create communities from their profile"
  on public.communities for insert to authenticated
  with check (public.is_community_adult() and created_by = (select auth.uid()));

drop policy if exists "Community owners and moderators can update community details" on public.communities;
create policy "Community owners and moderators can update community details"
  on public.communities for update to authenticated
  using (public.is_community_adult() and public.is_community_moderator(id))
  with check (public.is_community_adult() and created_by = communities.created_by);

drop policy if exists "Community owners can delete communities" on public.communities;
create policy "Community owners can delete communities"
  on public.communities for delete to authenticated
  using (created_by = (select auth.uid()) and public.is_community_adult());

drop policy if exists "Members can read their own membership" on public.community_members;
create policy "Members can read their own membership"
  on public.community_members for select to authenticated
  using (
    public.is_community_adult()
    and (
      user_id = (select auth.uid())
      or public.is_community_moderator(community_id)
    )
  );

grant select, insert, update, delete on public.communities to authenticated;
grant select on public.community_members to authenticated;

create or replace function public.add_community_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.community_members (community_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active')
  on conflict (community_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists communities_add_owner on public.communities;
create trigger communities_add_owner
  after insert on public.communities
  for each row execute function public.add_community_owner_membership();

-- Join requests are mediated by a database function so clients cannot self-approve private groups.
create or replace function public.join_community(community_id_input uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  member_id uuid := (select auth.uid());
  group_visibility text;
  next_status text;
begin
  if member_id is null or not public.is_community_adult() then
    raise exception 'Communities are available to adult members only.' using errcode = '42501';
  end if;
  select visibility into group_visibility from public.communities where id = community_id_input;
  if group_visibility is null then
    raise exception 'This community is unavailable.' using errcode = 'P0002';
  end if;
  if group_visibility = 'invite_only' then
    raise exception 'This community requires an invitation.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.community_blocks b
    where (b.blocker_id = member_id and b.blocked_id = (select created_by from public.communities where id = community_id_input))
       or (b.blocked_id = member_id and b.blocker_id = (select created_by from public.communities where id = community_id_input))
  ) then
    raise exception 'This community is unavailable.' using errcode = '42501';
  end if;
  next_status := case when group_visibility = 'private' then 'pending' else 'active' end;
  insert into public.community_members (community_id, user_id, role, status)
  values (community_id_input, member_id, 'member', next_status)
  on conflict (community_id, user_id) do update
    set status = case when public.community_members.role = 'owner' then 'active' else excluded.status end;
  return next_status;
end;
$$;

create or replace function public.leave_community(community_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_community_adult() then
    raise exception 'Communities are available to adult members only.' using errcode = '42501';
  end if;
  delete from public.community_members
  where community_id = community_id_input
    and user_id = (select auth.uid())
    and role <> 'owner';
  if not found then
    raise exception 'Owners must appoint another owner before leaving.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.is_community_adult_for(user_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
      when (s.state #>> '{profile,age}') ~ '^[0-9]{1,3}$'
        then ((s.state #>> '{profile,age}')::integer >= 18)
      else false
    end
    from public.user_app_state s
    where s.user_id = user_id_input
  ), false);
$$;

create or replace function public.invite_community_member(community_id_input uuid, username_input text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inviter_id uuid := (select auth.uid());
  invitee_id uuid;
begin
  if inviter_id is null or not public.is_community_adult() or not public.is_community_moderator(community_id_input) then
    raise exception 'Only community owners and moderators can invite members.' using errcode = '42501';
  end if;
  select user_id into invitee_id from public.community_profiles
    where lower(username) = lower(trim(both '@' from username_input));
  if invitee_id is null or not public.is_community_adult_for(invitee_id) then
    raise exception 'No eligible adult Vitalis member was found with that username.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.community_blocks b
    where (b.blocker_id = inviter_id and b.blocked_id = invitee_id)
       or (b.blocker_id = invitee_id and b.blocked_id = inviter_id)
  ) then
    raise exception 'This member cannot be invited.' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, user_id, role, status)
  values (community_id_input, invitee_id, 'member', 'invited')
  on conflict (community_id, user_id) do nothing;
  if not found then
    raise exception 'This member already has a community membership.' using errcode = '23505';
  end if;
end;
$$;

create or replace function public.accept_community_invite(community_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_community_adult() then
    raise exception 'Communities are available to adult members only.' using errcode = '42501';
  end if;
  update public.community_members set status = 'active'
    where community_id = community_id_input and user_id = (select auth.uid()) and status = 'invited';
  if not found then
    raise exception 'No invitation is available for this community.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.review_community_join_request(
  community_id_input uuid,
  member_user_id_input uuid,
  approve_input boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_community_adult() or not public.is_community_moderator(community_id_input) then
    raise exception 'Only community owners and moderators can review join requests.' using errcode = '42501';
  end if;
  if approve_input then
    update public.community_members set status = 'active'
      where community_id = community_id_input and user_id = member_user_id_input and status = 'pending';
  else
    delete from public.community_members
      where community_id = community_id_input and user_id = member_user_id_input and status = 'pending';
  end if;
  if not found then
    raise exception 'This join request is no longer pending.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.join_community(uuid) from public;
revoke all on function public.leave_community(uuid) from public;
revoke all on function public.is_community_adult_for(uuid) from public;
revoke all on function public.invite_community_member(uuid, text) from public;
revoke all on function public.accept_community_invite(uuid) from public;
revoke all on function public.review_community_join_request(uuid, uuid, boolean) from public;
grant execute on function public.join_community(uuid) to authenticated;
grant execute on function public.leave_community(uuid) to authenticated;
grant execute on function public.invite_community_member(uuid, text) to authenticated;
grant execute on function public.accept_community_invite(uuid) to authenticated;
grant execute on function public.review_community_join_request(uuid, uuid, boolean) to authenticated;

create table if not exists public.community_blocks (
  blocker_id uuid not null references public.community_profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.community_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.community_blocks enable row level security;

drop policy if exists "Adults can view their own blocks" on public.community_blocks;
create policy "Adults can view their own blocks"
  on public.community_blocks for select to authenticated
  using (public.is_community_adult() and blocker_id = (select auth.uid()));

drop policy if exists "Adults can block community members" on public.community_blocks;
create policy "Adults can block community members"
  on public.community_blocks for insert to authenticated
  with check (public.is_community_adult() and blocker_id = (select auth.uid()));

drop policy if exists "Adults can unblock community members" on public.community_blocks;
create policy "Adults can unblock community members"
  on public.community_blocks for delete to authenticated
  using (public.is_community_adult() and blocker_id = (select auth.uid()));

grant select, insert, delete on public.community_blocks to authenticated;

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_group_created_idx
  on public.community_messages (community_id, created_at desc);

alter table public.community_messages enable row level security;

drop policy if exists "Adults in good standing can read group messages" on public.community_messages;
create policy "Adults in good standing can read group messages"
  on public.community_messages for select to authenticated
  using (
    public.is_community_adult()
    and exists (
      select 1 from public.community_members m
      where m.community_id = community_messages.community_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
    )
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = community_messages.user_id)
         or (b.blocked_id = (select auth.uid()) and b.blocker_id = community_messages.user_id)
    )
  );

drop policy if exists "Active adults can send group messages" on public.community_messages;
create policy "Active adults can send group messages"
  on public.community_messages for insert to authenticated
  with check (
    public.is_community_adult()
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.community_members m
      where m.community_id = community_messages.community_id
        and m.user_id = (select auth.uid()) and m.status = 'active'
    )
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = community_messages.user_id)
         or (b.blocked_id = (select auth.uid()) and b.blocker_id = community_messages.user_id)
    )
  );

drop policy if exists "Authors and moderators can remove group messages" on public.community_messages;
create policy "Authors and moderators can remove group messages"
  on public.community_messages for delete to authenticated
  using (
    public.is_community_adult()
    and (
      user_id = (select auth.uid())
      or public.is_community_moderator(community_id)
    )
  );

grant select, insert, delete on public.community_messages to authenticated;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.community_profiles(user_id) on delete cascade,
  target_type text not null check (target_type in ('community', 'message')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 80),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists community_reports_status_created_idx
  on public.community_reports (status, created_at desc);

alter table public.community_reports enable row level security;

drop policy if exists "Adults can report community content" on public.community_reports;
create policy "Adults can report community content"
  on public.community_reports for insert to authenticated
  with check (
    public.is_community_adult()
    and reporter_id = (select auth.uid())
    and (
      (target_type = 'message' and exists (
        select 1 from public.community_messages m
        join public.community_members cm on cm.community_id = m.community_id
        where m.id = target_id and cm.user_id = (select auth.uid()) and cm.status = 'active'
      ))
      or (target_type = 'community' and exists (
        select 1 from public.communities c where c.id = target_id
      ))
    )
  );

drop policy if exists "Reporters can view their own reports" on public.community_reports;
create policy "Reporters can view their own reports"
  on public.community_reports for select to authenticated
  using (reporter_id = (select auth.uid()) and public.is_community_adult());

drop policy if exists "Community moderators can review reports" on public.community_reports;
create policy "Community moderators can review reports"
  on public.community_reports for select to authenticated
  using (
    public.is_community_adult()
    and exists (
      select 1 from public.community_messages msg
      where msg.id = community_reports.target_id
        and public.is_community_moderator(msg.community_id)
    )
  );

grant select, insert on public.community_reports to authenticated;

-- Follows and person-to-person message requests for the adult community beta.
create table if not exists public.community_follows (
  follower_id uuid not null references public.community_profiles(user_id) on delete cascade,
  following_id uuid not null references public.community_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists community_follows_following_idx
  on public.community_follows (following_id, created_at desc);

alter table public.community_follows enable row level security;

drop policy if exists "Adults can view their own follows" on public.community_follows;
create policy "Adults can view their own follows"
  on public.community_follows for select to authenticated
  using (public.is_community_adult() and follower_id = (select auth.uid()));

grant execute on function public.is_community_adult_for(uuid) to authenticated;

drop policy if exists "Adults can follow searchable members" on public.community_follows;
create policy "Adults can follow searchable members"
  on public.community_follows for insert to authenticated
  with check (
    public.is_community_adult()
    and follower_id = (select auth.uid())
    and public.is_community_adult_for(following_id)
    and exists (select 1 from public.community_profiles p where p.user_id = following_id and p.is_public)
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = follower_id and b.blocked_id = following_id)
         or (b.blocked_id = follower_id and b.blocker_id = following_id)
    )
  );

drop policy if exists "Adults can unfollow members" on public.community_follows;
create policy "Adults can unfollow members"
  on public.community_follows for delete to authenticated
  using (public.is_community_adult() and follower_id = (select auth.uid()));

grant select, insert, delete on public.community_follows to authenticated;

create table if not exists public.community_conversations (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.community_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.community_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);

create unique index if not exists community_conversations_pair_unique
  on public.community_conversations (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index if not exists community_conversations_requester_idx
  on public.community_conversations (requester_id, updated_at desc);
create index if not exists community_conversations_recipient_idx
  on public.community_conversations (recipient_id, updated_at desc);

create table if not exists public.community_direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_conversations(id) on delete cascade,
  sender_id uuid not null references public.community_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now()
);

create index if not exists community_direct_messages_conversation_idx
  on public.community_direct_messages (conversation_id, created_at asc);

create or replace function public.touch_community_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.community_conversations
    set updated_at = greatest(now(), updated_at + interval '1 microsecond')
    where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_community_conversation_after_message() from public;

drop trigger if exists community_direct_message_touch_conversation on public.community_direct_messages;
create trigger community_direct_message_touch_conversation
  after insert on public.community_direct_messages
  for each row execute function public.touch_community_conversation_after_message();

create or replace function public.is_community_conversation_participant(conversation_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.community_conversations c
    where c.id = conversation_id_input
      and (c.requester_id = (select auth.uid()) or c.recipient_id = (select auth.uid()))
  );
$$;

revoke all on function public.is_community_conversation_participant(uuid) from public;
grant execute on function public.is_community_conversation_participant(uuid) to authenticated;

alter table public.community_conversations enable row level security;
alter table public.community_direct_messages enable row level security;

drop policy if exists "Adults can view their direct conversations" on public.community_conversations;
create policy "Adults can view their direct conversations"
  on public.community_conversations for select to authenticated
  using (
    public.is_community_adult()
    and public.is_community_conversation_participant(id)
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = requester_id and b.blocked_id = recipient_id)
         or (b.blocked_id = requester_id and b.blocker_id = recipient_id)
    )
  );

drop policy if exists "Participants can read request and accepted messages" on public.community_direct_messages;
create policy "Participants can read request and accepted messages"
  on public.community_direct_messages for select to authenticated
  using (
    public.is_community_adult()
    and public.is_community_conversation_participant(conversation_id)
    and exists (
      select 1 from public.community_conversations c
      where c.id = conversation_id
        and c.status in ('pending', 'accepted')
        and not exists (
          select 1 from public.community_blocks b
          where (b.blocker_id = c.requester_id and b.blocked_id = c.recipient_id)
             or (b.blocked_id = c.requester_id and b.blocker_id = c.recipient_id)
        )
    )
  );

drop policy if exists "Participants can send after a request is accepted" on public.community_direct_messages;
create policy "Participants can send after a request is accepted"
  on public.community_direct_messages for insert to authenticated
  with check (
    public.is_community_adult()
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.community_conversations c
      where c.id = conversation_id
        and c.status = 'accepted'
        and (c.requester_id = (select auth.uid()) or c.recipient_id = (select auth.uid()))
        and not exists (
          select 1 from public.community_blocks b
          where (b.blocker_id = c.requester_id and b.blocked_id = c.recipient_id)
             or (b.blocked_id = c.requester_id and b.blocker_id = c.recipient_id)
        )
    )
  );

grant select on public.community_conversations to authenticated;
grant select, insert on public.community_direct_messages to authenticated;

-- A new contact sends one request message. The recipient must accept before a chat opens.
create or replace function public.start_community_conversation(
  target_user_id_input uuid,
  initial_message_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sender_id uuid := (select auth.uid());
  conversation_row public.community_conversations%rowtype;
  body_text text := trim(initial_message_input);
begin
  if sender_id is null or not public.is_community_adult() then
    raise exception 'Communities are available to adult members only.' using errcode = '42501';
  end if;
  if target_user_id_input is null or target_user_id_input = sender_id then
    raise exception 'Choose another Vitalis member to message.' using errcode = '22023';
  end if;
  if body_text is null or char_length(body_text) < 1 or char_length(body_text) > 1200 then
    raise exception 'A first message must be between 1 and 1200 characters.' using errcode = '22023';
  end if;
  if not public.is_community_adult_for(target_user_id_input) or not exists (
    select 1 from public.community_profiles p where p.user_id = target_user_id_input and p.is_public
  ) then
    raise exception 'This Vitalis member is not available for messaging.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.community_blocks b
    where (b.blocker_id = sender_id and b.blocked_id = target_user_id_input)
       or (b.blocked_id = sender_id and b.blocker_id = target_user_id_input)
  ) then
    raise exception 'This Vitalis member is not available for messaging.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(sender_id::text, target_user_id_input::text) || ':' || greatest(sender_id::text, target_user_id_input::text), 0));
  select * into conversation_row from public.community_conversations c
    where (c.requester_id = sender_id and c.recipient_id = target_user_id_input)
       or (c.requester_id = target_user_id_input and c.recipient_id = sender_id)
    for update;

  if found then
    if conversation_row.status = 'declined' then
      raise exception 'This message request was declined.' using errcode = '42501';
    elsif conversation_row.status = 'pending' then
      if conversation_row.requester_id = sender_id then
        raise exception 'Your message request is waiting for a response.' using errcode = 'P0001';
      end if;
      return conversation_row.id;
    end if;
    insert into public.community_direct_messages (conversation_id, sender_id, body)
      values (conversation_row.id, sender_id, body_text);
    return conversation_row.id;
  end if;

  if (select count(*) from public.community_conversations c
      where c.requester_id = sender_id and c.status = 'pending'
        and c.created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have reached the daily limit for new message requests.' using errcode = '54000';
  end if;

  insert into public.community_conversations (requester_id, recipient_id)
    values (sender_id, target_user_id_input)
    returning * into conversation_row;
  insert into public.community_direct_messages (conversation_id, sender_id, body)
    values (conversation_row.id, sender_id, body_text);
  return conversation_row.id;
end;
$$;

create or replace function public.respond_to_community_message_request(
  conversation_id_input uuid,
  accept_input boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_community_adult() then
    raise exception 'Communities are available to adult members only.' using errcode = '42501';
  end if;
  update public.community_conversations
    set status = case when accept_input then 'accepted' else 'declined' end,
        updated_at = now()
    where id = conversation_id_input
      and recipient_id = (select auth.uid())
      and status = 'pending'
      and not exists (
        select 1 from public.community_blocks b
        where (b.blocker_id = requester_id and b.blocked_id = recipient_id)
           or (b.blocked_id = requester_id and b.blocker_id = recipient_id)
      );
  if not found then
    raise exception 'This message request is no longer available.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.start_community_conversation(uuid, text) from public;
revoke all on function public.respond_to_community_message_request(uuid, boolean) from public;
grant execute on function public.start_community_conversation(uuid, text) to authenticated;
grant execute on function public.respond_to_community_message_request(uuid, boolean) to authenticated;

alter table public.community_reports drop constraint if exists community_reports_target_type_check;
alter table public.community_reports
  add constraint community_reports_target_type_check check (target_type in ('community', 'message', 'direct_message'));

drop policy if exists "Adults can report community content" on public.community_reports;
create policy "Adults can report community content"
  on public.community_reports for insert to authenticated
  with check (
    public.is_community_adult()
    and reporter_id = (select auth.uid())
    and (
      (target_type = 'message' and exists (
        select 1 from public.community_messages m
        join public.community_members cm on cm.community_id = m.community_id
        where m.id = target_id and cm.user_id = (select auth.uid()) and cm.status = 'active'
      ))
      or (target_type = 'community' and exists (
        select 1 from public.communities c where c.id = target_id
      ))
      or (target_type = 'direct_message' and exists (
        select 1 from public.community_direct_messages dm
        where dm.id = target_id and public.is_community_conversation_participant(dm.conversation_id)
      ))
    )
  );

-- Profile stories and achievements are optional, user-authored content.
alter table public.community_photos add column if not exists archived_at timestamptz;

drop policy if exists "Members can view photos from discoverable profiles" on public.community_photos;
create policy "Members can view photos from discoverable profiles"
  on public.community_photos for select to authenticated
  using (
    public.is_community_adult()
    and (
      (select auth.uid()) = user_id
      or (archived_at is null and exists (
        select 1 from public.community_profiles p
        where p.user_id = community_photos.user_id and p.is_public
      ))
    )
  );

drop policy if exists "Users can update their own community photos" on public.community_photos;
create policy "Users can update their own community photos"
  on public.community_photos for update to authenticated
  using (public.is_community_adult() and (select auth.uid()) = user_id)
  with check (public.is_community_adult() and (select auth.uid()) = user_id);
grant update on public.community_photos to authenticated;

create or replace function public.enforce_community_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  should_count boolean := tg_op = 'INSERT';
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if tg_op = 'UPDATE' then should_count := old.archived_at is not null and new.archived_at is null; end if;
  if new.archived_at is null and should_count
     and (select count(*) from public.community_photos where user_id = new.user_id and archived_at is null) >= 12 then
    raise exception 'A community profile can contain at most 12 active photos.';
  end if;
  return new;
end;
$$;

drop trigger if exists community_photos_limit on public.community_photos;
create trigger community_photos_limit
  before insert or update on public.community_photos
  for each row execute function public.enforce_community_photo_limit();

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  post_type text not null check (post_type in ('blog', 'achievement')),
  title text not null check (char_length(trim(title)) between 2 and 90),
  body text not null check (char_length(trim(body)) between 2 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists community_posts_user_created_idx
  on public.community_posts (user_id, created_at desc);

alter table public.community_posts enable row level security;

drop policy if exists "Members can read visible community profile posts" on public.community_posts;
create policy "Members can read visible community profile posts"
  on public.community_posts for select to authenticated
  using (
    public.is_community_adult()
    and (
      (select auth.uid()) = user_id
      or (archived_at is null and exists (
        select 1 from public.community_profiles p
        where p.user_id = community_posts.user_id and p.is_public
      ))
    )
  );

drop policy if exists "Adults can publish their own profile posts" on public.community_posts;
create policy "Adults can publish their own profile posts"
  on public.community_posts for insert to authenticated
  with check (public.is_community_adult() and (select auth.uid()) = user_id);

drop policy if exists "Adults can update their own profile posts" on public.community_posts;
create policy "Adults can update their own profile posts"
  on public.community_posts for update to authenticated
  using (public.is_community_adult() and (select auth.uid()) = user_id)
  with check (public.is_community_adult() and (select auth.uid()) = user_id);

drop policy if exists "Adults can delete their own profile posts" on public.community_posts;
create policy "Adults can delete their own profile posts"
  on public.community_posts for delete to authenticated
  using (public.is_community_adult() and (select auth.uid()) = user_id);

grant select, insert, update, delete on public.community_posts to authenticated;

-- Interpret one app record for the privacy-preserving consistency summary.
create or replace function public.community_day_is_complete(state_input jsonb, day_input date)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  day_key text := day_input::text;
  record_data jsonb := coalesce(state_input -> 'dailyRecords' -> day_key, '{}'::jsonb);
  today_key text;
  water_ml numeric := 0;
  water_goal numeric := 2300;
  workout_count numeric := 0;
  attendance_data jsonb;
begin
  today_key := case when coalesce(state_input ->> 'dailyPlanDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then state_input ->> 'dailyPlanDate' else current_date::text end;

  if day_key = today_key then
    if coalesce(state_input #>> '{hydration,consumed}', '') ~ '^[0-9]+([.][0-9]+)?$' then water_ml := (state_input #>> '{hydration,consumed}')::numeric; end if;
    if coalesce(state_input #>> '{hydration,goal}', '') ~ '^[0-9]+([.][0-9]+)?$' then water_goal := (state_input #>> '{hydration,goal}')::numeric; end if;
  else
    if coalesce(record_data ->> 'waterMl', '') ~ '^[0-9]+([.][0-9]+)?$' then water_ml := (record_data ->> 'waterMl')::numeric; end if;
    if coalesce(record_data ->> 'waterGoal', '') ~ '^[0-9]+([.][0-9]+)?$' then water_goal := (record_data ->> 'waterGoal')::numeric; end if;
  end if;

  if coalesce(record_data ->> 'workoutCount', '') ~ '^[0-9]+([.][0-9]+)?$' then workout_count := (record_data ->> 'workoutCount')::numeric; end if;
  if jsonb_typeof(state_input -> 'workoutLogs') = 'array' then
    select workout_count + count(*) into workout_count
    from jsonb_array_elements(state_input -> 'workoutLogs') log_row
    where log_row ->> 'date' = day_key;
  end if;
  attendance_data := state_input -> 'workoutAttendance' -> day_key;
  if jsonb_typeof(attendance_data) = 'object' then
    select workout_count + count(*) into workout_count
    from jsonb_each(attendance_data) attendance
    where attendance.value = 'true'::jsonb;
  end if;

  if water_ml >= water_goal and workout_count > 0 then return true; end if;
  if record_data = '{}'::jsonb and state_input #>> array['streakMap', day_key] = 'true' then return true; end if;
  return false;
end;
$$;

create or replace function public.get_community_fitness_metrics(target_user_id_input uuid)
returns table (fitness_score integer, current_streak integer, best_streak integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  owner_state jsonb;
  today_value date;
  tracking_start date;
  period_start date;
  day_value date;
  period_days integer := 0;
  complete_days integer := 0;
  run_length integer := 0;
  best_length integer := 0;
begin
  if (select auth.uid()) is null or not public.is_community_adult() or target_user_id_input is null then return; end if;
  if target_user_id_input <> (select auth.uid()) and not (
    exists (select 1 from public.community_profiles p where p.user_id = target_user_id_input and p.is_public)
    and exists (select 1 from public.community_follows f where f.follower_id = (select auth.uid()) and f.following_id = target_user_id_input)
    and exists (select 1 from public.community_follows f where f.follower_id = target_user_id_input and f.following_id = (select auth.uid()))
  ) then return; end if;

  select s.state into owner_state from public.user_app_state s where s.user_id = target_user_id_input;
  if owner_state is null then return query select null::integer, 0, 0; return; end if;
  today_value := case when coalesce(owner_state ->> 'dailyPlanDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then (owner_state ->> 'dailyPlanDate')::date else current_date end;
  tracking_start := case when coalesce(owner_state ->> 'workoutTrackingStartDate', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then (owner_state ->> 'workoutTrackingStartDate')::date else today_value - 30 end;
  tracking_start := greatest(tracking_start, today_value - 3650);
  period_start := greatest(tracking_start, today_value - 30);
  period_days := greatest(0, (today_value - period_start));

  if period_days > 0 then
    for day_value in select generate_series(period_start, today_value - 1, interval '1 day')::date loop
      if public.community_day_is_complete(owner_state, day_value) then complete_days := complete_days + 1; end if;
    end loop;
  end if;

  for day_value in select generate_series(tracking_start, today_value, interval '1 day')::date loop
    if day_value >= tracking_start and public.community_day_is_complete(owner_state, day_value) then
      run_length := run_length + 1;
      best_length := greatest(best_length, run_length);
    else
      run_length := 0;
    end if;
  end loop;

  run_length := 0;
  for day_value in select generate_series(today_value, tracking_start, interval '-1 day')::date loop
    if public.community_day_is_complete(owner_state, day_value) then run_length := run_length + 1; else exit; end if;
  end loop;
  return query select case when period_days > 0 then round(100.0 * complete_days / period_days)::integer else null::integer end, run_length, best_length;
end;
$$;

revoke all on function public.community_day_is_complete(jsonb, date) from public;
revoke all on function public.get_community_fitness_metrics(uuid) from public;
grant execute on function public.get_community_fitness_metrics(uuid) to authenticated;

-- A public avatar remains visible with a searchable profile; archived gallery files do not.
drop policy if exists "Members can view permitted community media" on storage.objects;
create policy "Members can view permitted community media"
  on storage.objects for select to authenticated
  using (
    public.is_community_adult()
    and bucket_id = 'community-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.community_profiles p
        where p.user_id::text = (storage.foldername(name))[1] and p.is_public
          and (
            p.avatar_path = name
            or exists (select 1 from public.community_photos photo where photo.user_id = p.user_id and photo.photo_path = name and photo.archived_at is null)
          )
      )
    )
  );
