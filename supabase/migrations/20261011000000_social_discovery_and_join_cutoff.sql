begin;

-- Service-only queries filter in PostgreSQL before PostgREST applies its row cap.
-- Actor identity comes exclusively from the verified JWT in the Edge handlers.
create function public.social_discover_profiles(trusted_actor_auth_user_id uuid, active_sport_id integer default null)
returns setof public.profiles
language sql stable security invoker set search_path = ''
as $$
  select candidate.* from public.profiles candidate
  join public.profiles actor on actor.auth_user_id = trusted_actor_auth_user_id
  where candidate.id <> actor.id and candidate.onboarding_completed
    and (active_sport_id is null or exists (
      select 1 from public.profile_sports ps
      where ps.profile_id = candidate.id and ps.sport_id = active_sport_id and ps.is_active
    ))
    and not exists (
      select 1 from public.profile_blocks b
      where (b.blocker_profile_id = actor.id and b.blocked_profile_id = candidate.id)
         or (b.blocked_profile_id = actor.id and b.blocker_profile_id = candidate.id)
    );
$$;

-- Strict boundary is separately testable with fixed timestamps. The acceptance
-- RPC supplies clock_timestamp() after locking; clients cannot supply that time.
create function public.social_open_join_before_cutoff(scheduled_start timestamptz, backend_time timestamptz)
returns boolean language sql immutable security invoker set search_path = ''
as $$ select coalesce(scheduled_start > backend_time, false); $$;

create function public.social_discover_open_challenges(trusted_actor_auth_user_id uuid)
returns setof public.challenges
language sql stable security invoker set search_path = ''
as $$
  select c.* from public.challenges c
  join public.profiles actor on actor.auth_user_id = trusted_actor_auth_user_id
  where actor.onboarding_completed and c.is_open and c.status = 'pending'
    and c.opponent_profile_id is null
    and public.social_open_join_before_cutoff(c.scheduled_at, pg_catalog.statement_timestamp())
    and not exists (
      select 1 from public.profile_blocks b
      where (b.blocker_profile_id = actor.id and b.blocked_profile_id = c.challenger_profile_id)
         or (b.blocked_profile_id = actor.id and b.blocker_profile_id = c.challenger_profile_id)
    );
$$;

revoke all on function public.social_discover_profiles(uuid, integer) from public, anon, authenticated;
revoke all on function public.social_discover_open_challenges(uuid) from public, anon, authenticated;
revoke all on function public.social_open_join_before_cutoff(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.social_discover_profiles(uuid, integer) to service_role;
grant execute on function public.social_discover_open_challenges(uuid) to service_role;
grant execute on function public.social_open_join_before_cutoff(timestamptz, timestamptz) to service_role;

create or replace function public.social_accept_challenge(
  trusted_actor_auth_user_id uuid,
  target_challenge_id uuid,
  join_open boolean
)
returns setof public.challenges
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  owner_profile_id uuid;
  recipient_profile_id uuid;
  action_time timestamptz;
begin
  select profiles.id into actor_profile_id
  from public.profiles
  where profiles.auth_user_id = trusted_actor_auth_user_id
    and profiles.onboarding_completed;
  if actor_profile_id is null or target_challenge_id is null then
    raise exception using errcode = 'P0001', message = 'Challenge unavailable';
  end if;

  select challenges.challenger_profile_id, challenges.opponent_profile_id
  into owner_profile_id, recipient_profile_id
  from public.challenges
  where challenges.id = target_challenge_id
    and challenges.status = 'pending'
    and challenges.is_open = join_open;
  if owner_profile_id is null
    or owner_profile_id = actor_profile_id
    or (join_open and recipient_profile_id is not null)
    or (not join_open and recipient_profile_id is distinct from actor_profile_id) then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(owner_profile_id, actor_profile_id)::text || ':' || greatest(owner_profile_id, actor_profile_id)::text, 0
    )
  );
  if public.social_pair_is_blocked(owner_profile_id, actor_profile_id) then
    return;
  end if;
  -- Keep the existing pair-before-row lock order. Read the backend clock only
  -- after acquiring the row lock so a waiter cannot join after the cutoff.
  perform 1 from public.challenges where id = target_challenge_id for update;
  action_time := pg_catalog.clock_timestamp();

  return query
  update public.challenges
  set status = 'accepted',
      accepted_at = action_time,
      opponent_profile_id = case when join_open then actor_profile_id else challenges.opponent_profile_id end,
      is_open = false
  where challenges.id = target_challenge_id
    and challenges.challenger_profile_id = owner_profile_id
    and challenges.status = 'pending'
    and challenges.is_open = join_open
    and (not join_open or public.social_open_join_before_cutoff(challenges.scheduled_at, action_time))
    and (join_open and challenges.opponent_profile_id is null
      or not join_open and challenges.opponent_profile_id = actor_profile_id)
  returning challenges.*;
end;
$$;

revoke all on function public.social_accept_challenge(uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.social_accept_challenge(uuid, uuid, boolean)
to service_role;


commit;
