-- Loop 4.2A friendship and blocking database foundation.
--
-- All mutation functions in this migration are reserved for trusted backend
-- callers. Phase 4.2B Edge Functions must derive trusted_actor_auth_user_id
-- from a verified Supabase session; ordinary browser roles cannot execute
-- these functions or read/write the underlying tables directly.

begin;

create type public.friend_relationship_status as enum (
  'pending',
  'accepted',
  'declined',
  'removed'
);

create table public.friend_relationships (
  profile_a_id uuid not null references public.profiles(id) on delete cascade,
  profile_b_id uuid not null references public.profiles(id) on delete cascade,
  requested_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.friend_relationship_status not null default 'pending',
  requested_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  accepted_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_a_id, profile_b_id),
  constraint friend_relationships_canonical_pair_check
    check (profile_a_id < profile_b_id),
  constraint friend_relationships_requester_membership_check
    check (requested_by_profile_id in (profile_a_id, profile_b_id)),
  constraint friend_relationships_timestamp_order_check
    check (
      (responded_at is null or responded_at >= requested_at)
      and (accepted_at is null or accepted_at >= requested_at)
      and (ended_at is null or ended_at >= requested_at)
    ),
  constraint friend_relationships_state_check
    check (
      (
        status = 'pending'
        and responded_at is null
        and accepted_at is null
        and ended_at is null
      )
      or
      (
        status = 'accepted'
        and responded_at is not null
        and accepted_at is not null
        and ended_at is null
      )
      or
      (
        status = 'declined'
        and responded_at is not null
        and accepted_at is null
        and ended_at is not null
      )
      or
      (
        status = 'removed'
        and responded_at is not null
        and ended_at is not null
      )
    )
);

create index friend_relationships_profile_a_status_idx
  on public.friend_relationships (profile_a_id, status, updated_at desc);
create index friend_relationships_profile_b_status_idx
  on public.friend_relationships (profile_b_id, status, updated_at desc);
create index friend_relationships_requester_status_idx
  on public.friend_relationships (requested_by_profile_id, status, requested_at desc);

create table public.profile_blocks (
  blocker_profile_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_profile_id, blocked_profile_id),
  constraint profile_blocks_distinct_profiles_check
    check (blocker_profile_id <> blocked_profile_id)
);

create index profile_blocks_blocked_blocker_idx
  on public.profile_blocks (blocked_profile_id, blocker_profile_id);

alter table public.friend_relationships enable row level security;
alter table public.profile_blocks enable row level security;

revoke all privileges on table
  public.friend_relationships,
  public.profile_blocks
from public, anon, authenticated;

grant all privileges on table
  public.friend_relationships,
  public.profile_blocks
to service_role;

-- Returns only the mutually effective block result, never the initiator.
create function public.social_pair_is_blocked(
  first_profile_id uuid,
  second_profile_id uuid
)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_blocks
    where (
      profile_blocks.blocker_profile_id = first_profile_id
      and profile_blocks.blocked_profile_id = second_profile_id
    ) or (
      profile_blocks.blocker_profile_id = second_profile_id
      and profile_blocks.blocked_profile_id = first_profile_id
    )
  );
$$;

create function public.social_send_friend_request(
  trusted_actor_auth_user_id uuid,
  target_profile_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  pair_a_id uuid;
  pair_b_id uuid;
  relationship public.friend_relationships%rowtype;
  action_time timestamptz;
begin
  select profiles.id
  into actor_profile_id
  from public.profiles
  where profiles.auth_user_id = trusted_actor_auth_user_id
    and profiles.onboarding_completed;

  if actor_profile_id is null then
    raise exception using errcode = 'P0001', message = 'Actor profile unavailable';
  end if;

  if target_profile_id is null or target_profile_id = actor_profile_id then
    raise exception using errcode = 'P0001', message = 'Invalid friend request target';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = target_profile_id
      and profiles.onboarding_completed
  ) then
    raise exception using errcode = 'P0001', message = 'Target profile unavailable';
  end if;

  pair_a_id := least(actor_profile_id, target_profile_id);
  pair_b_id := greatest(actor_profile_id, target_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_a_id::text || ':' || pair_b_id::text, 0)
  );
  action_time := pg_catalog.clock_timestamp();

  if public.social_pair_is_blocked(actor_profile_id, target_profile_id) then
    raise exception using errcode = 'P0001', message = 'Social interaction unavailable';
  end if;

  select friend_relationships.*
  into relationship
  from public.friend_relationships
  where friend_relationships.profile_a_id = pair_a_id
    and friend_relationships.profile_b_id = pair_b_id
  for update;

  if not found then
    insert into public.friend_relationships (
      profile_a_id,
      profile_b_id,
      requested_by_profile_id,
      status,
      requested_at,
      updated_at
    ) values (
      pair_a_id,
      pair_b_id,
      actor_profile_id,
      'pending',
      action_time,
      action_time
    );
    return 'outgoing_pending';
  end if;

  if relationship.status = 'pending' then
    if relationship.requested_by_profile_id = actor_profile_id then
      return 'outgoing_pending';
    end if;

    update public.friend_relationships
    set
      status = 'accepted',
      responded_at = action_time,
      accepted_at = action_time,
      ended_at = null,
      updated_at = action_time
    where friend_relationships.profile_a_id = pair_a_id
      and friend_relationships.profile_b_id = pair_b_id;
    return 'friends';
  end if;

  if relationship.status = 'accepted' then
    return 'friends';
  end if;

  if relationship.status = 'declined'
    and relationship.ended_at > action_time - interval '7 days' then
    raise exception using errcode = 'P0001', message = 'Friend request cooldown active';
  end if;

  update public.friend_relationships
  set
    requested_by_profile_id = actor_profile_id,
    status = 'pending',
    requested_at = action_time,
    responded_at = null,
    accepted_at = null,
    ended_at = null,
    updated_at = action_time
  where friend_relationships.profile_a_id = pair_a_id
    and friend_relationships.profile_b_id = pair_b_id;

  return 'outgoing_pending';
end;
$$;

create function public.social_respond_to_friend_request(
  trusted_actor_auth_user_id uuid,
  requester_profile_id uuid,
  response_action text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  pair_a_id uuid;
  pair_b_id uuid;
  relationship public.friend_relationships%rowtype;
  action_time timestamptz;
begin
  if response_action not in ('accept', 'decline') then
    raise exception using errcode = 'P0001', message = 'Invalid friend request response';
  end if;

  select profiles.id
  into actor_profile_id
  from public.profiles
  where profiles.auth_user_id = trusted_actor_auth_user_id
    and profiles.onboarding_completed;

  if actor_profile_id is null then
    raise exception using errcode = 'P0001', message = 'Actor profile unavailable';
  end if;

  if requester_profile_id is null or requester_profile_id = actor_profile_id then
    raise exception using errcode = 'P0001', message = 'Invalid friend request';
  end if;

  pair_a_id := least(actor_profile_id, requester_profile_id);
  pair_b_id := greatest(actor_profile_id, requester_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_a_id::text || ':' || pair_b_id::text, 0)
  );
  action_time := pg_catalog.clock_timestamp();

  select friend_relationships.*
  into relationship
  from public.friend_relationships
  where friend_relationships.profile_a_id = pair_a_id
    and friend_relationships.profile_b_id = pair_b_id
  for update;

  if not found
    or relationship.status <> 'pending'
    or relationship.requested_by_profile_id <> requester_profile_id then
    raise exception using errcode = 'P0001', message = 'Pending friend request unavailable';
  end if;

  if public.social_pair_is_blocked(actor_profile_id, requester_profile_id) then
    raise exception using errcode = 'P0001', message = 'Social interaction unavailable';
  end if;

  if response_action = 'accept' then
    update public.friend_relationships
    set
      status = 'accepted',
      responded_at = action_time,
      accepted_at = action_time,
      ended_at = null,
      updated_at = action_time
    where friend_relationships.profile_a_id = pair_a_id
      and friend_relationships.profile_b_id = pair_b_id;
    return 'friends';
  end if;

  update public.friend_relationships
  set
    status = 'declined',
    responded_at = action_time,
    accepted_at = null,
    ended_at = action_time,
    updated_at = action_time
  where friend_relationships.profile_a_id = pair_a_id
    and friend_relationships.profile_b_id = pair_b_id;
  return 'none';
end;
$$;

create function public.social_cancel_friend_request(
  trusted_actor_auth_user_id uuid,
  target_profile_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  pair_a_id uuid;
  pair_b_id uuid;
  action_time timestamptz;
begin
  select profiles.id
  into actor_profile_id
  from public.profiles
  where profiles.auth_user_id = trusted_actor_auth_user_id
    and profiles.onboarding_completed;

  if actor_profile_id is null
    or target_profile_id is null
    or target_profile_id = actor_profile_id then
    raise exception using errcode = 'P0001', message = 'Pending friend request unavailable';
  end if;

  pair_a_id := least(actor_profile_id, target_profile_id);
  pair_b_id := greatest(actor_profile_id, target_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_a_id::text || ':' || pair_b_id::text, 0)
  );
  action_time := pg_catalog.clock_timestamp();

  update public.friend_relationships
  set
    status = 'removed',
    responded_at = action_time,
    accepted_at = null,
    ended_at = action_time,
    updated_at = action_time
  where friend_relationships.profile_a_id = pair_a_id
    and friend_relationships.profile_b_id = pair_b_id
    and friend_relationships.status = 'pending'
    and friend_relationships.requested_by_profile_id = actor_profile_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Pending friend request unavailable';
  end if;

  return 'none';
end;
$$;

create function public.social_remove_friendship(
  trusted_actor_auth_user_id uuid,
  other_profile_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  pair_a_id uuid;
  pair_b_id uuid;
  action_time timestamptz;
begin
  select profiles.id
  into actor_profile_id
  from public.profiles
  where profiles.auth_user_id = trusted_actor_auth_user_id
    and profiles.onboarding_completed;

  if actor_profile_id is null
    or other_profile_id is null
    or other_profile_id = actor_profile_id then
    raise exception using errcode = 'P0001', message = 'Friendship unavailable';
  end if;

  pair_a_id := least(actor_profile_id, other_profile_id);
  pair_b_id := greatest(actor_profile_id, other_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_a_id::text || ':' || pair_b_id::text, 0)
  );
  action_time := pg_catalog.clock_timestamp();

  update public.friend_relationships
  set
    status = 'removed',
    ended_at = action_time,
    updated_at = action_time
  where friend_relationships.profile_a_id = pair_a_id
    and friend_relationships.profile_b_id = pair_b_id
    and friend_relationships.status = 'accepted';

  if not found then
    raise exception using errcode = 'P0001', message = 'Friendship unavailable';
  end if;

  return 'none';
end;
$$;

create function public.social_block_profile(
  trusted_actor_auth_user_id uuid,
  target_profile_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  pair_a_id uuid;
  pair_b_id uuid;
  action_time timestamptz;
begin
  select profiles.id
  into actor_profile_id
  from public.profiles
  where profiles.auth_user_id = trusted_actor_auth_user_id
    and profiles.onboarding_completed;

  if actor_profile_id is null then
    raise exception using errcode = 'P0001', message = 'Actor profile unavailable';
  end if;

  if target_profile_id is null or target_profile_id = actor_profile_id then
    raise exception using errcode = 'P0001', message = 'Invalid block target';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = target_profile_id
  ) then
    raise exception using errcode = 'P0001', message = 'Target profile unavailable';
  end if;

  pair_a_id := least(actor_profile_id, target_profile_id);
  pair_b_id := greatest(actor_profile_id, target_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_a_id::text || ':' || pair_b_id::text, 0)
  );
  action_time := pg_catalog.clock_timestamp();

  insert into public.profile_blocks (
    blocker_profile_id,
    blocked_profile_id,
    created_at
  ) values (
    actor_profile_id,
    target_profile_id,
    action_time
  )
  on conflict (blocker_profile_id, blocked_profile_id) do nothing;

  update public.friend_relationships
  set
    status = 'removed',
    responded_at = coalesce(friend_relationships.responded_at, action_time),
    ended_at = action_time,
    updated_at = action_time
  where friend_relationships.profile_a_id = pair_a_id
    and friend_relationships.profile_b_id = pair_b_id
    and friend_relationships.status in ('pending', 'accepted');

  -- A block ends only unaccepted direct invitations. Accepted matches and
  -- globally visible open invitations retain their existing lifecycle.
  update public.challenges
  set status = 'canceled', canceled_at = action_time
  where challenges.status = 'pending'
    and not challenges.is_open
    and (
      (challenges.challenger_profile_id = actor_profile_id and challenges.opponent_profile_id = target_profile_id)
      or (challenges.challenger_profile_id = target_profile_id and challenges.opponent_profile_id = actor_profile_id)
    );

  return true;
end;
$$;

-- Service-role challenge writes bypass RLS. This guard shares the social pair
-- lock, closing the check/write race for direct creation and acceptance.
create function public.social_guard_challenge_pair()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pair_a_id uuid;
  pair_b_id uuid;
begin
  if new.opponent_profile_id is null or new.is_open then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not (
      (old.status = 'pending' and new.status = 'accepted')
      or (old.is_open and not new.is_open)
      or (new.status = 'pending' and (
        old.challenger_profile_id is distinct from new.challenger_profile_id
        or old.opponent_profile_id is distinct from new.opponent_profile_id
      ))
    ) then
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' and new.status not in ('pending', 'accepted') then
    return new;
  end if;

  pair_a_id := least(new.challenger_profile_id, new.opponent_profile_id);
  pair_b_id := greatest(new.challenger_profile_id, new.opponent_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_a_id::text || ':' || pair_b_id::text, 0)
  );

  if public.social_pair_is_blocked(pair_a_id, pair_b_id) then
    raise exception using errcode = 'P0001', message = 'Challenge unavailable';
  end if;
  return new;
end;
$$;

create trigger social_guard_challenge_pair
before insert or update on public.challenges
for each row execute function public.social_guard_challenge_pair();

revoke all on function public.social_guard_challenge_pair()
from public, anon, authenticated;

-- Acceptance must take the pair lock before locking the challenge row. A
-- trigger alone would take those locks in reverse order and could deadlock
-- against social_block_profile's pending-challenge cleanup.
create function public.social_accept_challenge(
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
    and (join_open and challenges.opponent_profile_id is null
      or not join_open and challenges.opponent_profile_id = actor_profile_id)
  returning challenges.*;
end;
$$;

revoke all on function public.social_accept_challenge(uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.social_accept_challenge(uuid, uuid, boolean)
to service_role;

create function public.social_unblock_profile(
  trusted_actor_auth_user_id uuid,
  target_profile_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  pair_a_id uuid;
  pair_b_id uuid;
  removed_count integer;
begin
  select profiles.id
  into actor_profile_id
  from public.profiles
  where profiles.auth_user_id = trusted_actor_auth_user_id
    and profiles.onboarding_completed;

  if actor_profile_id is null
    or target_profile_id is null
    or target_profile_id = actor_profile_id then
    raise exception using errcode = 'P0001', message = 'Block unavailable';
  end if;

  pair_a_id := least(actor_profile_id, target_profile_id);
  pair_b_id := greatest(actor_profile_id, target_profile_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pair_a_id::text || ':' || pair_b_id::text, 0)
  );

  delete from public.profile_blocks
  where profile_blocks.blocker_profile_id = actor_profile_id
    and profile_blocks.blocked_profile_id = target_profile_id;
  get diagnostics removed_count = row_count;

  return removed_count = 1;
end;
$$;

revoke all on function public.social_pair_is_blocked(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.social_send_friend_request(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.social_respond_to_friend_request(uuid, uuid, text)
from public, anon, authenticated;
revoke all on function public.social_cancel_friend_request(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.social_remove_friendship(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.social_block_profile(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.social_unblock_profile(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.social_pair_is_blocked(uuid, uuid)
to service_role;
grant execute on function public.social_send_friend_request(uuid, uuid)
to service_role;
grant execute on function public.social_respond_to_friend_request(uuid, uuid, text)
to service_role;
grant execute on function public.social_cancel_friend_request(uuid, uuid)
to service_role;
grant execute on function public.social_remove_friendship(uuid, uuid)
to service_role;
grant execute on function public.social_block_profile(uuid, uuid)
to service_role;
grant execute on function public.social_unblock_profile(uuid, uuid)
to service_role;

commit;
