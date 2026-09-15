-- Finish the move to native Supabase Auth. Historical migrations still describe
-- the previous schema, but no live database object depends on Firebase identity.

-- Link existing profiles to Auth users with matching emails before removing the
-- legacy identity column. This preserves the small set of pre-migration profiles.
update public.profiles as profile
set auth_user_id = auth_user.id
from auth.users as auth_user
where profile.auth_user_id is null
  and profile.email is not null
  and auth_user.email is not null
  and lower(profile.email) = lower(auth_user.email);

-- Activity is now read through the authenticated get-activity-feed Edge
-- Function, so this obsolete RPC can be removed entirely.
drop function if exists public.get_activity_feed_for_profile(uuid, integer);

create or replace function public.create_open_challenge(
  p_sport_id integer,
  p_scheduled_at timestamptz,
  p_location_name text,
  p_challenge_type public.challenge_type,
  p_stake_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
  created_challenge_id uuid;
begin
  select id into caller_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if caller_profile_id is null then
    raise exception 'Unable to resolve the current profile.';
  end if;

  insert into public.challenges (
    sport_id, challenger_profile_id, opponent_profile_id, challenge_type,
    stake_note, scheduled_at, location_name, status, is_open
  ) values (
    p_sport_id, caller_profile_id, null, p_challenge_type,
    nullif(trim(coalesce(p_stake_note, '')), ''), p_scheduled_at,
    nullif(trim(coalesce(p_location_name, '')), ''), 'pending', true
  )
  returning id into created_challenge_id;

  return created_challenge_id;
end;
$$;

create or replace function public.accept_open_challenge(p_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
  accepted_challenge_id uuid;
  existing_challenge public.challenges%rowtype;
begin
  select id into caller_profile_id
  from public.profiles
  where auth_user_id = auth.uid();

  if caller_profile_id is null then
    raise exception 'Unable to resolve the current profile.';
  end if;

  update public.challenges
  set opponent_profile_id = caller_profile_id,
      status = 'accepted',
      accepted_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_challenge_id
    and is_open = true
    and status = 'pending'
    and opponent_profile_id is null
    and challenger_profile_id <> caller_profile_id
  returning id into accepted_challenge_id;

  if accepted_challenge_id is not null then
    return accepted_challenge_id;
  end if;

  select * into existing_challenge
  from public.challenges
  where id = p_challenge_id;

  if not found then raise exception 'Challenge not found.'; end if;
  if existing_challenge.challenger_profile_id = caller_profile_id then
    raise exception 'You cannot accept your own open challenge.';
  end if;
  if existing_challenge.is_open = false then raise exception 'This challenge is not open.'; end if;
  if existing_challenge.status <> 'pending' or existing_challenge.opponent_profile_id is not null then
    raise exception 'This open challenge is no longer available.';
  end if;

  raise exception 'Unable to accept this open challenge.';
end;
$$;

create or replace function public.get_open_challenges(p_sport_id smallint default null)
returns table (
  challenge_id uuid,
  challenger_profile_id uuid,
  challenger_username text,
  challenger_display_name text,
  challenger_area text,
  sport_id smallint,
  sport_slug public.sport_slug,
  sport_name text,
  scheduled_at timestamptz,
  location_name text,
  challenge_type public.challenge_type,
  stake_note text,
  created_at timestamptz,
  matches_played integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
  caller_area text;
begin
  select id, vancouver_area into caller_profile_id, caller_area
  from public.profiles
  where auth_user_id = auth.uid();

  if caller_profile_id is null then
    raise exception 'Unable to resolve the current profile.';
  end if;

  return query
  select
    c.id, challenger.id, challenger.username, challenger.display_name,
    challenger.vancouver_area, s.id, s.slug, s.name, c.scheduled_at,
    c.location_name, c.challenge_type, c.stake_note, c.created_at,
    coalesce(stats.matches_played, 0)
  from public.challenges c
  join public.profiles challenger on challenger.id = c.challenger_profile_id
  join public.sports s on s.id = c.sport_id
  left join public.profile_stats stats on stats.profile_id = challenger.id
  where c.is_open = true
    and c.status = 'pending'
    and c.opponent_profile_id is null
    and c.challenger_profile_id <> caller_profile_id
    and c.scheduled_at > timezone('utc', now())
    and (p_sport_id is null or c.sport_id = p_sport_id)
  order by case when challenger.vancouver_area = caller_area then 0 else 1 end,
           c.created_at desc;
end;
$$;

revoke execute on function public.create_open_challenge(integer, timestamptz, text, public.challenge_type, text) from anon;
revoke execute on function public.accept_open_challenge(uuid) from anon;
revoke execute on function public.get_open_challenges(smallint) from anon;
grant execute on function public.create_open_challenge(integer, timestamptz, text, public.challenge_type, text) to authenticated;
grant execute on function public.accept_open_challenge(uuid) to authenticated;
grant execute on function public.get_open_challenges(smallint) to authenticated;

-- These profile policies were added directly to the hosted database and are
-- redundant with "users can manage their own profile" from the Auth migration.
drop policy if exists "users can read their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;
drop policy if exists "temporary profile insert" on public.profiles;

drop policy if exists "challengers can create pending open challenges" on public.challenges;
create policy "challengers can create pending open challenges"
on public.challenges for insert
with check (
  is_open = true
  and status = 'pending'
  and opponent_profile_id is null
  and exists (
    select 1 from public.profiles p
    where p.id = challenges.challenger_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "authenticated users can accept pending open challenges" on public.challenges;
create policy "authenticated users can accept pending open challenges"
on public.challenges for update
using (
  is_open = true and status = 'pending' and opponent_profile_id is null
  and exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id <> challenges.challenger_profile_id
  )
)
with check (
  is_open = true and status = 'accepted' and opponent_profile_id is not null
  and exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.id = challenges.opponent_profile_id
      and p.id <> challenges.challenger_profile_id
  )
);

drop policy if exists "participants can read related activity events" on public.activity_events;
create policy "participants can read related activity events"
on public.activity_events for select
using (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id in (activity_events.actor_profile_id, activity_events.target_profile_id)
));

drop policy if exists "users can create their own activity events" on public.activity_events;
create policy "users can create their own activity events"
on public.activity_events for insert
with check (exists (
  select 1 from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.id = activity_events.actor_profile_id
));

drop policy if exists "users can read their own live sessions" on public.live_sessions;
create policy "users can read their own live sessions"
on public.live_sessions for select
using (exists (
  select 1 from public.profiles p
  where p.id = live_sessions.profile_id and p.auth_user_id = auth.uid()
));

drop policy if exists "users can create their own live sessions" on public.live_sessions;
create policy "users can create their own live sessions"
on public.live_sessions for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = live_sessions.profile_id and p.auth_user_id = auth.uid()
));

drop policy if exists "users can update their own live sessions" on public.live_sessions;
create policy "users can update their own live sessions"
on public.live_sessions for update
using (exists (
  select 1 from public.profiles p
  where p.id = live_sessions.profile_id and p.auth_user_id = auth.uid()
))
with check (exists (
  select 1 from public.profiles p
  where p.id = live_sessions.profile_id and p.auth_user_id = auth.uid()
));

drop policy if exists "users can delete their own live sessions" on public.live_sessions;
create policy "users can delete their own live sessions"
on public.live_sessions for delete
using (exists (
  select 1 from public.profiles p
  where p.id = live_sessions.profile_id and p.auth_user_id = auth.uid()
));

-- This intentionally has no CASCADE. Deployment must fail if any unconverted
-- live database object still depends on the compatibility function or column.
drop function public.requesting_firebase_uid();
alter table public.profiles drop column firebase_uid;
