alter table public.challenges
  add column if not exists is_open boolean not null default false;

alter table public.challenges
  alter column opponent_profile_id drop not null;

alter table public.challenges
  drop constraint if exists challenges_distinct_profiles_check;

alter table public.challenges
  drop constraint if exists challenges_participant_shape_check;

alter table public.challenges
  add constraint challenges_participant_shape_check
  check (
    (
      is_open = false
      and opponent_profile_id is not null
      and challenger_profile_id <> opponent_profile_id
    )
    or
    (
      is_open = true
      and (
        (status = 'pending' and opponent_profile_id is null)
        or
        (
          status in ('accepted', 'declined', 'completed', 'canceled')
          and opponent_profile_id is not null
          and challenger_profile_id <> opponent_profile_id
        )
      )
    )
  );

create index if not exists challenges_open_pending_lookup_idx
on public.challenges (sport_id, scheduled_at asc, created_at desc)
where is_open = true and status = 'pending' and opponent_profile_id is null;

create or replace function public.create_open_challenge(
  p_sport_id smallint,
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
  select id
  into caller_profile_id
  from public.profiles
  where firebase_uid = public.requesting_firebase_uid();

  if caller_profile_id is null then
    raise exception 'Unable to resolve the current profile.';
  end if;

  insert into public.challenges (
    sport_id,
    challenger_profile_id,
    opponent_profile_id,
    challenge_type,
    stake_note,
    scheduled_at,
    location_name,
    status,
    is_open
  )
  values (
    p_sport_id,
    caller_profile_id,
    null,
    p_challenge_type,
    nullif(trim(coalesce(p_stake_note, '')), ''),
    p_scheduled_at,
    nullif(trim(coalesce(p_location_name, '')), ''),
    'pending',
    true
  )
  returning id into created_challenge_id;

  if created_challenge_id is null then
    raise exception 'Unable to create open challenge.';
  end if;

  return created_challenge_id;
end;
$$;

create or replace function public.accept_open_challenge(
  p_challenge_id uuid
)
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
  select id
  into caller_profile_id
  from public.profiles
  where firebase_uid = public.requesting_firebase_uid();

  if caller_profile_id is null then
    raise exception 'Unable to resolve the current profile.';
  end if;

  update public.challenges
  set
    opponent_profile_id = caller_profile_id,
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

  select *
  into existing_challenge
  from public.challenges
  where id = p_challenge_id;

  if not found then
    raise exception 'Challenge not found.';
  end if;

  if existing_challenge.challenger_profile_id = caller_profile_id then
    raise exception 'You cannot accept your own open challenge.';
  end if;

  if existing_challenge.is_open = false then
    raise exception 'This challenge is not open.';
  end if;

  if existing_challenge.status <> 'pending' or existing_challenge.opponent_profile_id is not null then
    raise exception 'This open challenge is no longer available.';
  end if;

  raise exception 'Unable to accept this open challenge.';
end;
$$;

create or replace function public.get_open_challenges(
  p_sport_id smallint default null
)
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
  select id, vancouver_area
  into caller_profile_id, caller_area
  from public.profiles
  where firebase_uid = public.requesting_firebase_uid();

  if caller_profile_id is null then
    raise exception 'Unable to resolve the current profile.';
  end if;

  return query
  select
    c.id as challenge_id,
    challenger.id as challenger_profile_id,
    challenger.username as challenger_username,
    challenger.display_name as challenger_display_name,
    challenger.vancouver_area as challenger_area,
    s.id as sport_id,
    s.slug as sport_slug,
    s.name as sport_name,
    c.scheduled_at,
    c.location_name,
    c.challenge_type,
    c.stake_note,
    c.created_at,
    coalesce(stats.matches_played, 0) as matches_played
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
  order by
    case when challenger.vancouver_area = caller_area then 0 else 1 end,
    c.created_at desc;
end;
$$;

grant execute on function public.create_open_challenge(smallint, timestamptz, text, public.challenge_type, text) to anon, authenticated;
grant execute on function public.accept_open_challenge(uuid) to anon, authenticated;
grant execute on function public.get_open_challenges(smallint) to anon, authenticated;
