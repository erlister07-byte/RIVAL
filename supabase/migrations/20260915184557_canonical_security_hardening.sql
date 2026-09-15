-- RIVAL H2 canonical security hardening.
--
-- This forward-only convergence migration removes browser-owned writes from
-- server-authoritative flows, moves trigger helpers out of the exposed public
-- schema, and retains only the canonical service-role result RPC surface.

begin;

-- Production has been observed with the three required historical avatar
-- policies below and, in older states, with the optional delete policy too.
-- Accept either exact legacy shape, or the already-hardened zero-policy shape
-- used by a fresh canonical baseline. Reject partial, altered, or additional
-- avatar policy sets before making any persistent security changes.
do $migration$
declare
  avatar_policy_count integer;
  invalid_required_policies text;
  invalid_optional_policy text;
  unexpected_avatar_policies text;
  has_legacy_security_surface boolean;
begin
  select count(*)
  into avatar_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and (
      policyname ilike '%avatar%'
      or coalesce(qual, '') ilike '%avatars%'
      or coalesce(with_check, '') ilike '%avatars%'
    );

  has_legacy_security_surface :=
    to_regprocedure('public.accept_open_challenge(uuid)') is not null
    or to_regprocedure('public.create_open_challenge(integer,timestamptz,text,public.challenge_type,text)') is not null
    or to_regprocedure('public.get_open_challenges(smallint)') is not null
    or to_regprocedure('public.handle_challenge_accepted()') is not null;

  if avatar_policy_count = 0 then
    if has_legacy_security_surface then
      raise exception 'Historical security surface is present but required avatar policies are missing.';
    end if;
  else
    with expected(policyname, cmd, qual, with_check) as (
      values
        ('Authenticated users can read avatars', 'SELECT', '(bucket_id = ''avatars''::text)', null::text),
        ('Authenticated users can upload avatars', 'INSERT', null::text, '(bucket_id = ''avatars''::text)'),
        ('Authenticated users can update avatars', 'UPDATE', '(bucket_id = ''avatars''::text)', '(bucket_id = ''avatars''::text)')
    )
    select string_agg(expected.policyname, ', ' order by expected.policyname)
    into invalid_required_policies
    from expected
    left join pg_policies
      on pg_policies.schemaname = 'storage'
      and pg_policies.tablename = 'objects'
      and pg_policies.policyname = expected.policyname
    where pg_policies.policyname is null
      or pg_policies.cmd <> expected.cmd
      or pg_policies.permissive <> 'PERMISSIVE'
      or pg_policies.roles <> array['authenticated']::name[]
      or pg_policies.qual is distinct from expected.qual
      or pg_policies.with_check is distinct from expected.with_check;

    select policyname
    into invalid_optional_policy
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete avatars'
      and (
        cmd <> 'DELETE'
        or permissive <> 'PERMISSIVE'
        or roles <> array['authenticated']::name[]
        or qual is distinct from '(bucket_id = ''avatars''::text)'
        or with_check is not null
      );

    select string_agg(policyname, ', ' order by policyname)
    into unexpected_avatar_policies
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname ilike '%avatar%'
        or coalesce(qual, '') ilike '%avatars%'
        or coalesce(with_check, '') ilike '%avatars%'
      )
      and policyname not in (
        'Authenticated users can read avatars',
        'Authenticated users can upload avatars',
        'Authenticated users can update avatars',
        'Authenticated users can delete avatars'
      );

    if avatar_policy_count not in (3, 4)
      or invalid_required_policies is not null
      or invalid_optional_policy is not null
      or unexpected_avatar_policies is not null then
      raise exception
        'Unexpected avatar policy surface (count %, invalid required %, invalid optional %, unexpected %).',
        avatar_policy_count,
        coalesce(invalid_required_policies, 'none'),
        coalesce(invalid_optional_policy, 'none'),
        coalesce(unexpected_avatar_policies, 'none');
    end if;
  end if;
end
$migration$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Move legacy public trigger helpers into the private schema without changing
-- their OIDs. Fresh canonical databases already have these private functions.
-- A simultaneous public/private copy is unexpected and fails closed.
-- ---------------------------------------------------------------------------

do $migration$
begin
  if to_regprocedure('public.handle_challenge_accepted()') is not null
    and to_regprocedure('private.handle_challenge_accepted()') is null then
    alter function public.handle_challenge_accepted() set schema private;
  end if;

  if to_regprocedure('public.handle_challenge_activity_event()') is not null
    and to_regprocedure('private.handle_challenge_activity_event()') is null then
    alter function public.handle_challenge_activity_event() set schema private;
  end if;

  if to_regprocedure('public.recalculate_profile_stats(uuid)') is not null
    and to_regprocedure('private.recalculate_profile_stats(uuid)') is null then
    alter function public.recalculate_profile_stats(uuid) set schema private;
  end if;

  if to_regprocedure('public.handle_match_result_change()') is not null
    and to_regprocedure('private.handle_match_result_change()') is null then
    alter function public.handle_match_result_change() set schema private;
  end if;

  if to_regprocedure('public.prevent_confirmed_match_mutation()') is not null
    and to_regprocedure('private.prevent_confirmed_match_mutation()') is null then
    alter function public.prevent_confirmed_match_mutation() set schema private;
  end if;

  if to_regprocedure('public.handle_match_completed_activity_event()') is not null
    and to_regprocedure('private.handle_match_completed_activity_event()') is null then
    alter function public.handle_match_completed_activity_event() set schema private;
  end if;

  if to_regprocedure('public.apply_rating_on_confirmed_match()') is not null
    and to_regprocedure('private.apply_rating_on_confirmed_match()') is null then
    alter function public.apply_rating_on_confirmed_match() set schema private;
  end if;
end
$migration$;

do $migration$
declare
  required_signature text;
begin
  foreach required_signature in array array[
    'private.handle_challenge_accepted()',
    'private.handle_challenge_activity_event()',
    'private.recalculate_profile_stats(uuid)',
    'private.handle_match_result_change()',
    'private.prevent_confirmed_match_mutation()',
    'private.handle_match_completed_activity_event()',
    'private.apply_rating_on_confirmed_match()',
    'private.validate_match_challenge_consistency()',
    'private.recalculate_profile_xp(uuid)',
    'private.award_match_xp_on_confirmation()'
  ]
  loop
    if to_regprocedure(required_signature) is null then
      raise exception 'Required private function is missing: %', required_signature;
    end if;
  end loop;
end
$migration$;

alter function private.handle_challenge_accepted() security definer set search_path to '';
alter function private.handle_challenge_activity_event() security definer set search_path to '';
alter function private.recalculate_profile_stats(uuid) security definer set search_path to '';
alter function private.handle_match_result_change() security definer set search_path to '';
alter function private.prevent_confirmed_match_mutation() security invoker set search_path to '';
alter function private.handle_match_completed_activity_event() security definer set search_path to '';
alter function private.apply_rating_on_confirmed_match() security definer set search_path to '';
alter function private.validate_match_challenge_consistency() security definer set search_path to '';
alter function private.recalculate_profile_xp(uuid) security definer set search_path to '';
alter function private.award_match_xp_on_confirmation() security definer set search_path to '';

-- These definitions remove the final public-helper calls from the trigger path.
create or replace function private.handle_match_result_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affects_confirmed_result boolean :=
    old.result_status = 'confirmed' or new.result_status = 'confirmed';
  result_fields_changed boolean :=
    old.result_status is distinct from new.result_status
    or old.result_outcome is distinct from new.result_outcome
    or old.winner_profile_id is distinct from new.winner_profile_id
    or old.loser_profile_id is distinct from new.loser_profile_id
    or old.challenger_profile_id is distinct from new.challenger_profile_id
    or old.opponent_profile_id is distinct from new.opponent_profile_id;
begin
  if old.result_status is distinct from new.result_status then
    if new.result_status = 'confirmed' then
      update public.challenges
      set
        status = 'completed',
        completed_at = coalesce(new.confirmed_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
      where id = new.challenge_id and status <> 'completed';
    elsif old.result_status = 'confirmed' then
      update public.challenges
      set
        status = 'accepted',
        completed_at = null,
        updated_at = timezone('utc', now())
      where id = new.challenge_id and status = 'completed';
    end if;
  end if;

  if affects_confirmed_result and result_fields_changed then
    perform private.recalculate_profile_stats(old.challenger_profile_id);
    perform private.recalculate_profile_stats(old.opponent_profile_id);
    perform private.recalculate_profile_stats(new.challenger_profile_id);
    perform private.recalculate_profile_stats(new.opponent_profile_id);
  end if;

  return new;
end;
$$;

create or replace function private.prevent_confirmed_match_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.result_status = 'confirmed' and new is distinct from old then
    raise exception 'Confirmed matches are immutable.';
  end if;

  return new;
end;
$$;

create or replace function private.handle_match_completed_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_actor_profile_id uuid;
  event_target_profile_id uuid;
  actor_name text;
  target_name text;
  sport_name text;
begin
  if new.result_status <> 'confirmed'
    or old.result_status is not distinct from 'confirmed' then
    return new;
  end if;

  event_actor_profile_id := case
    when new.result_outcome = 'win' then new.winner_profile_id
    else coalesce(new.submitted_by_profile_id, new.challenger_profile_id)
  end;

  event_target_profile_id := case
    when new.result_outcome = 'win' then new.loser_profile_id
    when event_actor_profile_id = new.challenger_profile_id then new.opponent_profile_id
    else new.challenger_profile_id
  end;

  select display_name into actor_name
  from public.profiles where id = event_actor_profile_id;

  select display_name into target_name
  from public.profiles where id = event_target_profile_id;

  select name into sport_name
  from public.sports where id = new.sport_id;

  insert into public.activity_events (
    actor_profile_id,
    target_profile_id,
    challenge_id,
    match_id,
    sport_id,
    event_type,
    metadata
  )
  values (
    event_actor_profile_id,
    event_target_profile_id,
    new.challenge_id,
    new.id,
    new.sport_id,
    'match_completed',
    jsonb_build_object(
      'actor_display_name', coalesce(actor_name, 'Player'),
      'target_display_name', coalesce(target_name, 'Player'),
      'sport_name', coalesce(sport_name, 'Sport'),
      'score', coalesce(new.score_summary, ''),
      'challenge_location', new.location_name,
      'result_outcome', new.result_outcome
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Rebuild the trigger bindings explicitly before removing public helpers.
drop trigger if exists create_match_on_accepted_challenge on public.challenges;
create trigger create_match_on_accepted_challenge
after update on public.challenges
for each row
when (new.status = 'accepted' and old.status is distinct from 'accepted')
execute function private.handle_challenge_accepted();

drop trigger if exists activity_event_on_challenge_insert on public.challenges;
create trigger activity_event_on_challenge_insert
after insert on public.challenges
for each row execute function private.handle_challenge_activity_event();

drop trigger if exists activity_event_on_challenge_accept on public.challenges;
create trigger activity_event_on_challenge_accept
after update on public.challenges
for each row
when (new.status = 'accepted' and old.status is distinct from 'accepted')
execute function private.handle_challenge_activity_event();

drop trigger if exists prevent_confirmed_match_mutation on public.matches;
create trigger prevent_confirmed_match_mutation
before update on public.matches
for each row execute function private.prevent_confirmed_match_mutation();

drop trigger if exists activity_event_on_match_completed on public.matches;
create trigger activity_event_on_match_completed
after update of result_status on public.matches
for each row
when (new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed')
execute function private.handle_match_completed_activity_event();

drop trigger if exists apply_rating_on_confirmed_match on public.matches;
create trigger apply_rating_on_confirmed_match
after update of result_status on public.matches
for each row
when (new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed')
execute function private.apply_rating_on_confirmed_match();

drop trigger if exists award_xp_on_match_confirmed on public.matches;
create trigger award_xp_on_match_confirmed
after update of result_status on public.matches
for each row
when (new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed')
execute function private.award_match_xp_on_confirmation();

drop trigger if exists sync_challenge_and_stats_on_match_update on public.matches;
create trigger sync_challenge_and_stats_on_match_update
after update on public.matches
for each row execute function private.handle_match_result_change();

drop trigger if exists validate_match_challenge_consistency on public.matches;
create trigger validate_match_challenge_consistency
before insert or update of challenge_id, sport_id, challenger_profile_id, opponent_profile_id
on public.matches
for each row execute function private.validate_match_challenge_consistency();

-- ---------------------------------------------------------------------------
-- Canonical server-facing result RPCs retain their exact signatures and bodies.
-- ---------------------------------------------------------------------------

do $migration$
declare
  required_signature text;
begin
  foreach required_signature in array array[
    'public.submit_match_result_v2(uuid,uuid,public.match_result_outcome,uuid,text,text)',
    'public.confirm_match_result(uuid,uuid)',
    'public.reject_match_result(uuid,uuid)',
    'public.auto_confirm_overdue_match_results(uuid)'
  ]
  loop
    if to_regprocedure(required_signature) is null then
      raise exception 'Required canonical result RPC is missing: %', required_signature;
    end if;
  end loop;
end
$migration$;

alter function public.submit_match_result_v2(
  uuid, uuid, public.match_result_outcome, uuid, text, text
) security definer set search_path to '';
alter function public.confirm_match_result(uuid, uuid)
  security definer set search_path to '';
alter function public.reject_match_result(uuid, uuid)
  security definer set search_path to '';
alter function public.auto_confirm_overdue_match_results(uuid)
  security definer set search_path to '';

revoke all on function public.submit_match_result_v2(
  uuid, uuid, public.match_result_outcome, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.submit_match_result_v2(
  uuid, uuid, public.match_result_outcome, uuid, text, text
) to service_role;

revoke all on function public.confirm_match_result(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.confirm_match_result(uuid, uuid)
to service_role;

revoke all on function public.reject_match_result(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.reject_match_result(uuid, uuid)
to service_role;

revoke all on function public.auto_confirm_overdue_match_results(uuid)
from public, anon, authenticated;
grant execute on function public.auto_confirm_overdue_match_results(uuid)
to service_role;

-- ---------------------------------------------------------------------------
-- Remove dead public helpers/RPCs only after all trigger dependencies are private.
-- Exact signatures and no CASCADE make unexpected dependencies fail closed.
-- ---------------------------------------------------------------------------

drop function if exists public.accept_open_challenge(uuid);
drop function if exists public.create_open_challenge(
  integer, timestamptz, text, public.challenge_type, text
);
drop function if exists public.get_open_challenges(smallint);
drop function if exists public.requesting_user_id();
drop function if exists public.set_updated_at();
drop function if exists public.submit_match_result(uuid, uuid, uuid, uuid, text, text);
drop function if exists public.insert_activity_event(
  uuid, uuid, uuid, uuid, smallint, text, jsonb
);
drop function if exists public.recalculate_profile_stats(uuid);
drop function if exists public.handle_challenge_accepted();
drop function if exists public.handle_challenge_activity_event();
drop function if exists public.handle_match_completed_activity_event();
drop function if exists public.handle_match_result_change();
drop function if exists public.prevent_confirmed_match_mutation();
drop function if exists public.apply_rating_on_confirmed_match();

-- No active application or database object depends on these legacy booleans.
alter table public.matches
  drop column if exists is_disputed,
  drop column if exists auto_confirmed;

-- ---------------------------------------------------------------------------
-- Replace application-table policies with the canonical least-privilege set.
-- ---------------------------------------------------------------------------

do $migration$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'sports', 'profiles', 'profile_sports', 'profile_stats',
        'challenges', 'matches', 'activity_events', 'play_locations',
        'live_sessions', 'profile_sport_ratings', 'match_rating_ledger',
        'profile_xp_ledger'
      )
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$migration$;

alter table public.sports enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_sports enable row level security;
alter table public.profile_stats enable row level security;
alter table public.challenges enable row level security;
alter table public.matches enable row level security;
alter table public.activity_events enable row level security;
alter table public.play_locations enable row level security;
alter table public.live_sessions enable row level security;
alter table public.profile_sport_ratings enable row level security;
alter table public.match_rating_ledger enable row level security;
alter table public.profile_xp_ledger enable row level security;

create policy sports_public_read
on public.sports for select
to anon, authenticated
using (true);

create policy profiles_read_own
on public.profiles for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy profiles_update_own
on public.profiles for update
to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

create policy profile_sports_read_own
on public.profile_sports for select
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_sports.profile_id
    and profiles.auth_user_id = (select auth.uid())
));

create policy profile_sports_insert_own
on public.profile_sports for insert
to authenticated
with check (exists (
  select 1 from public.profiles
  where profiles.id = profile_sports.profile_id
    and profiles.auth_user_id = (select auth.uid())
));

create policy profile_sports_update_own
on public.profile_sports for update
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_sports.profile_id
    and profiles.auth_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = profile_sports.profile_id
    and profiles.auth_user_id = (select auth.uid())
));

create policy profile_stats_read_own
on public.profile_stats for select
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = profile_stats.profile_id
    and profiles.auth_user_id = (select auth.uid())
));

create policy challenges_read_participant
on public.challenges for select
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.auth_user_id = (select auth.uid())
    and profiles.id in (
      challenges.challenger_profile_id,
      challenges.opponent_profile_id
    )
));

create policy matches_read_participant
on public.matches for select
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.auth_user_id = (select auth.uid())
    and profiles.id in (
      matches.challenger_profile_id,
      matches.opponent_profile_id
    )
));

create policy activity_events_read_participant
on public.activity_events for select
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.auth_user_id = (select auth.uid())
    and profiles.id in (
      activity_events.actor_profile_id,
      activity_events.target_profile_id
    )
));

create policy play_locations_public_read_active
on public.play_locations for select
to anon, authenticated
using (is_active);

create policy live_sessions_read_own
on public.live_sessions for select
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = live_sessions.profile_id
    and profiles.auth_user_id = (select auth.uid())
));

create policy live_sessions_insert_own
on public.live_sessions for insert
to authenticated
with check (exists (
  select 1 from public.profiles
  where profiles.id = live_sessions.profile_id
    and profiles.auth_user_id = (select auth.uid())
));

create policy live_sessions_update_own
on public.live_sessions for update
to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = live_sessions.profile_id
    and profiles.auth_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = live_sessions.profile_id
    and profiles.auth_user_id = (select auth.uid())
));

-- ---------------------------------------------------------------------------
-- Explicit table and default privileges.
-- ---------------------------------------------------------------------------

revoke all privileges on table
  public.sports,
  public.profiles,
  public.profile_sports,
  public.profile_stats,
  public.challenges,
  public.matches,
  public.activity_events,
  public.play_locations,
  public.live_sessions,
  public.profile_sport_ratings,
  public.match_rating_ledger,
  public.profile_xp_ledger
from public, anon, authenticated;

revoke all on all sequences in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.sports, public.play_locations to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (
  email,
  username,
  display_name,
  vancouver_area,
  challenge_radius_km,
  latitude,
  longitude,
  availability_status,
  onboarding_completed,
  updated_at
) on public.profiles to authenticated;
grant select, insert, update on public.profile_sports to authenticated;
grant select on public.profile_stats to authenticated;
grant select on public.challenges to authenticated;
grant select on public.matches to authenticated;
grant select on public.activity_events to authenticated;
grant select, insert, update on public.live_sessions to authenticated;

grant all privileges on table
  public.sports,
  public.profiles,
  public.profile_sports,
  public.profile_stats,
  public.challenges,
  public.matches,
  public.activity_events,
  public.play_locations,
  public.live_sessions,
  public.profile_sport_ratings,
  public.match_rating_ledger,
  public.profile_xp_ledger
to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

revoke all on all functions in schema private
from public, anon, authenticated, service_role;

-- Avatar reads use the public bucket endpoint. All writes are owned by the
-- upload-avatar Edge Function; no browser storage policy is required.
drop policy if exists "Authenticated users can read avatars" on storage.objects;
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;
drop policy if exists "Authenticated users can delete avatars" on storage.objects;

-- ---------------------------------------------------------------------------
-- Query-path indexes absent from production. Existing equivalent indexes are
-- retained; these are the genuinely missing composite/partial access paths.
-- ---------------------------------------------------------------------------

create index if not exists profiles_vancouver_area_idx
  on public.profiles (vancouver_area);
create index if not exists profiles_onboarding_location_idx
  on public.profiles (onboarding_completed, latitude, longitude)
  where onboarding_completed;
create index if not exists profile_sports_sport_active_skill_idx
  on public.profile_sports (sport_id, is_active, skill_level, profile_id);
create index if not exists challenges_opponent_status_scheduled_idx
  on public.challenges (opponent_profile_id, status, scheduled_at desc);
create index if not exists challenges_challenger_status_created_idx
  on public.challenges (challenger_profile_id, status, created_at desc);
create index if not exists challenges_pending_open_sport_scheduled_idx
  on public.challenges (sport_id, scheduled_at, created_at desc)
  where is_open and status = 'pending' and opponent_profile_id is null;
create index if not exists matches_challenger_result_history_idx
  on public.matches (challenger_profile_id, result_status, played_at desc, confirmed_at desc);
create index if not exists matches_opponent_result_history_idx
  on public.matches (opponent_profile_id, result_status, played_at desc, confirmed_at desc);
create index if not exists matches_confirmed_winner_idx
  on public.matches (winner_profile_id, confirmed_at desc)
  where result_status = 'confirmed' and result_outcome = 'win';
create index if not exists matches_confirmed_loser_idx
  on public.matches (loser_profile_id, confirmed_at desc)
  where result_status = 'confirmed' and result_outcome = 'win';
create index if not exists activity_events_actor_created_idx
  on public.activity_events (actor_profile_id, created_at desc);
create index if not exists activity_events_target_created_idx
  on public.activity_events (target_profile_id, created_at desc)
  where target_profile_id is not null;
create index if not exists play_locations_sport_active_name_idx
  on public.play_locations (sport, is_active, name);
create index if not exists live_sessions_profile_status_updated_idx
  on public.live_sessions (profile_id, status, updated_at desc);
create index if not exists live_sessions_sport_status_expiry_idx
  on public.live_sessions (sport, status, expires_at);
create index if not exists profile_sport_ratings_sport_rating_idx
  on public.profile_sport_ratings (sport_id, rating desc, profile_id);
create index if not exists match_rating_ledger_sport_applied_idx
  on public.match_rating_ledger (sport_id, applied_at desc);

-- ---------------------------------------------------------------------------
-- Fail-closed catalog assertions.
-- ---------------------------------------------------------------------------

do $migration$
declare
  trigger_schema_mismatch text;
begin
  select string_agg(t.tgname, ', ' order by t.tgname)
  into trigger_schema_mismatch
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace n on n.oid = p.pronamespace
  where not t.tgisinternal
    and t.tgname in (
      'validate_match_challenge_consistency',
      'create_match_on_accepted_challenge',
      'activity_event_on_challenge_insert',
      'activity_event_on_challenge_accept',
      'prevent_confirmed_match_mutation',
      'activity_event_on_match_completed',
      'apply_rating_on_confirmed_match',
      'award_xp_on_match_confirmed',
      'sync_challenge_and_stats_on_match_update'
    )
    and n.nspname <> 'private';

  if trigger_schema_mismatch is not null then
    raise exception 'Trigger functions remain outside private schema: %', trigger_schema_mismatch;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'accept_open_challenge', 'create_open_challenge', 'get_open_challenges',
        'requesting_user_id', 'set_updated_at', 'submit_match_result',
        'insert_activity_event', 'recalculate_profile_stats',
        'handle_challenge_accepted', 'handle_challenge_activity_event',
        'handle_match_completed_activity_event', 'handle_match_result_change',
        'prevent_confirmed_match_mutation', 'apply_rating_on_confirmed_match'
      )
  ) then
    raise exception 'Legacy public function remains after H2.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name in ('is_disputed', 'auto_confirmed')
  ) then
    raise exception 'Legacy match boolean remains after H2.';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) then
    raise exception 'Browser role retains a prohibited broad table privilege.';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'authenticated'
      and table_name in (
        'challenges', 'matches', 'activity_events', 'profile_stats',
        'profile_sport_ratings', 'match_rating_ledger', 'profile_xp_ledger'
      )
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'Browser role retains a server-owned mutation privilege.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Authenticated users can read avatars',
        'Authenticated users can upload avatars',
        'Authenticated users can update avatars',
        'Authenticated users can delete avatars'
      )
  ) then
    raise exception 'Legacy avatar browser policy remains after H2.';
  end if;

  if exists (
    select 1
    from pg_roles r
    cross join pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where r.rolname in ('anon', 'authenticated')
      and n.nspname = 'public'
      and p.proname in (
        'submit_match_result_v2', 'confirm_match_result',
        'reject_match_result', 'auto_confirm_overdue_match_results'
      )
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  ) then
    raise exception 'Browser role can execute a canonical result RPC.';
  end if;

  if exists (
    select 1
    from pg_roles r
    cross join pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where r.rolname in ('anon', 'authenticated', 'service_role')
      and n.nspname = 'private'
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
  ) then
    raise exception 'Non-owner role can execute a private function.';
  end if;
end
$migration$;

commit;
