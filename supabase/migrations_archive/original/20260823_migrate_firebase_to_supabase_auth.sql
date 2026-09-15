-- Consolidate identity into Supabase Auth. Existing test profiles are preserved
-- and can be claimed by a newly-created Supabase Auth account with the same email.

alter table public.profiles
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

-- This legacy column remains temporarily for older database RPCs. New writes
-- mirror the Supabase user id into it; it is no longer an authentication source.
alter table public.profiles
  alter column firebase_uid drop not null;

create index if not exists profiles_auth_user_id_idx
on public.profiles (auth_user_id);

-- Remove the temporary anonymous development bypass before relying on native
-- Supabase authentication in production.
drop policy if exists "local dev anon can read sports" on public.sports;
drop policy if exists "local dev anon can manage profiles" on public.profiles;
drop policy if exists "local dev anon can manage profile sports" on public.profile_sports;
drop policy if exists "local dev anon can read profile stats" on public.profile_stats;
drop policy if exists "local dev anon can manage challenges" on public.challenges;
drop policy if exists "local dev anon can manage matches" on public.matches;
drop policy if exists "local dev anon can manage activity events" on public.activity_events;

-- Avatar mutations go through the authenticated upload-avatar Edge Function.
drop policy if exists "anon can upload avatars" on storage.objects;
drop policy if exists "anon can update avatars" on storage.objects;

create or replace function public.requesting_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- Compatibility for existing RPCs while their Firebase-era name is retired.
create or replace function public.requesting_firebase_uid()
returns text
language sql
stable
as $$
  select auth.uid()::text;
$$;

-- Replace the legacy Firebase identity policies with native Supabase Auth policies.
drop policy if exists "users can manage their own profile" on public.profiles;
create policy "users can manage their own profile"
on public.profiles for all
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists "users can manage their own player sports" on public.profile_sports;
create policy "users can manage their own player sports"
on public.profile_sports for all
using (exists (
  select 1 from public.profiles p
  where p.id = profile_sports.profile_id and p.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.profiles p
  where p.id = profile_sports.profile_id and p.auth_user_id = auth.uid()
));

drop policy if exists "participants can read their challenges" on public.challenges;
create policy "participants can read their challenges"
on public.challenges for select
using (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id in (challenges.challenger_profile_id, challenges.opponent_profile_id)
));

drop policy if exists "challengers can create challenges" on public.challenges;
create policy "challengers can create challenges"
on public.challenges for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = challenges.challenger_profile_id and p.auth_user_id = auth.uid()
));

drop policy if exists "participants can update challenge status" on public.challenges;
create policy "participants can update challenge status"
on public.challenges for update
using (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id in (challenges.challenger_profile_id, challenges.opponent_profile_id)
))
with check (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id in (challenges.challenger_profile_id, challenges.opponent_profile_id)
));

drop policy if exists "participants can read their matches" on public.matches;
create policy "participants can read their matches"
on public.matches for select
using (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id in (matches.challenger_profile_id, matches.opponent_profile_id)
));

drop policy if exists "participants can update their matches" on public.matches;
create policy "participants can update their matches"
on public.matches for update
using (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id in (matches.challenger_profile_id, matches.opponent_profile_id)
))
with check (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id in (matches.challenger_profile_id, matches.opponent_profile_id)
));

drop policy if exists "users can read their own stats" on public.profile_stats;
create policy "users can read their own stats"
on public.profile_stats for select
using (exists (
  select 1 from public.profiles p
  where p.id = profile_stats.profile_id and p.auth_user_id = auth.uid()
));
