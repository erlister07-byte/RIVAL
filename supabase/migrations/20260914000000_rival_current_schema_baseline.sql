-- RIVAL canonical fresh-database baseline.
--
-- Provenance checkpoint: 18e1a8e32722ad9e12ec20e135c3d268bcb1202e
-- Constructed: 2026-09-14
--
-- This is a fresh-database baseline, not a convergence migration. It must not be
-- applied to the existing production project. Historical migrations are retained
-- under supabase/migrations_archive for audit only.

-- -----------------------------------------------------------------------------
-- Extensions and schemas
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Domain enums
-- -----------------------------------------------------------------------------

create type public.sport_slug as enum (
  'tennis',
  'basketball',
  'pickleball',
  'golf',
  'volleyball',
  'running'
);

create type public.skill_level as enum (
  'beginner',
  'intermediate',
  'advanced',
  'competitive'
);

create type public.challenge_status as enum (
  'pending',
  'accepted',
  'declined',
  'completed',
  'canceled'
);

create type public.challenge_type as enum (
  'casual',
  'practice',
  'ranked'
);

create type public.match_result_status as enum (
  'pending_submission',
  'pending_confirmation',
  'confirmed',
  'disputed'
);

create type public.match_result_outcome as enum ('win', 'draw');

-- -----------------------------------------------------------------------------
-- Reference and profile tables
-- -----------------------------------------------------------------------------

create table public.sports (
  id smallint primary key,
  slug public.sport_slug not null unique,
  name text not null unique,
  is_team_sport boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text unique,
  username text not null unique,
  display_name text not null,
  vancouver_area text not null,
  challenge_radius_km integer not null default 10,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  availability_status text default 'unavailable',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_challenge_radius_check
    check (challenge_radius_km between 1 and 100),
  constraint profiles_vancouver_area_check
    check (vancouver_area in (
      'Downtown',
      'Kitsilano',
      'Mount Pleasant',
      'East Vancouver',
      'West End',
      'North Vancouver',
      'Burnaby',
      'Richmond',
      'Surrey',
      'New Westminster'
    )),
  constraint profiles_availability_status_check
    check (availability_status is null or availability_status in (
      'now', 'today', 'this_week', 'unavailable'
    ))
);

create table public.profile_sports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sport_id smallint not null references public.sports(id) on delete restrict,
  skill_level public.skill_level not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_sports_unique_profile_sport unique (profile_id, sport_id)
);

create table public.profile_stats (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  matches_played integer not null default 0,
  xp bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_stats_wins_nonnegative check (wins >= 0),
  constraint profile_stats_losses_nonnegative check (losses >= 0),
  constraint profile_stats_draws_nonnegative check (draws >= 0),
  constraint profile_stats_matches_played_nonnegative check (matches_played >= 0),
  constraint profile_stats_xp_nonnegative check (xp >= 0),
  constraint profile_stats_record_consistency
    check (matches_played = wins + losses + draws)
);

-- -----------------------------------------------------------------------------
-- Challenges and matches
-- -----------------------------------------------------------------------------

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  sport_id smallint not null references public.sports(id) on delete restrict,
  challenger_profile_id uuid not null references public.profiles(id) on delete cascade,
  opponent_profile_id uuid references public.profiles(id) on delete cascade,
  challenge_type public.challenge_type not null,
  stake_type text not null default 'bragging_rights',
  stake_label text not null default 'Bragging Rights',
  stake_note text,
  scheduled_at timestamptz not null,
  location_name text not null,
  location_latitude numeric(9, 6),
  location_longitude numeric(9, 6),
  status public.challenge_status not null default 'pending',
  is_open boolean not null default false,
  accepted_at timestamptz,
  declined_at timestamptz,
  canceled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint challenges_participant_shape_check check (
    (
      is_open
      and opponent_profile_id is null
      and status in ('pending', 'canceled')
    )
    or
    (
      not is_open
      and opponent_profile_id is not null
      and challenger_profile_id <> opponent_profile_id
    )
  ),
  constraint challenges_status_timestamps_check check (
    (status <> 'accepted' or accepted_at is not null)
    and (status <> 'declined' or declined_at is not null)
    and (status <> 'canceled' or canceled_at is not null)
    and (status <> 'completed' or (accepted_at is not null and completed_at is not null))
  )
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null unique references public.challenges(id) on delete cascade,
  sport_id smallint not null references public.sports(id) on delete restrict,
  challenger_profile_id uuid not null references public.profiles(id) on delete cascade,
  opponent_profile_id uuid not null references public.profiles(id) on delete cascade,
  played_at timestamptz,
  location_name text not null,
  location_latitude numeric(9, 6),
  location_longitude numeric(9, 6),
  result_status public.match_result_status not null default 'pending_submission',
  result_outcome public.match_result_outcome,
  submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  winner_profile_id uuid references public.profiles(id) on delete set null,
  loser_profile_id uuid references public.profiles(id) on delete set null,
  score_summary text,
  result_notes text,
  confirmed_by_profile_id uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  result_confirmation_deadline_at timestamptz,
  result_confirmation_method text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint matches_distinct_participants_check
    check (challenger_profile_id <> opponent_profile_id),
  constraint matches_actor_membership_check check (
    (submitted_by_profile_id is null or submitted_by_profile_id in (
      challenger_profile_id, opponent_profile_id
    ))
    and (confirmed_by_profile_id is null or confirmed_by_profile_id in (
      challenger_profile_id, opponent_profile_id
    ))
    and (winner_profile_id is null or winner_profile_id in (
      challenger_profile_id, opponent_profile_id
    ))
    and (loser_profile_id is null or loser_profile_id in (
      challenger_profile_id, opponent_profile_id
    ))
  ),
  constraint matches_confirmation_method_check
    check (result_confirmation_method is null or result_confirmation_method in ('manual', 'auto')),
  constraint matches_result_state_check check (
    (
      result_status = 'pending_submission'
      and result_outcome is null
      and submitted_by_profile_id is null
      and submitted_at is null
      and winner_profile_id is null
      and loser_profile_id is null
      and confirmed_by_profile_id is null
      and confirmed_at is null
      and result_confirmation_method is null
    )
    or
    (
      result_status = 'pending_confirmation'
      and result_outcome is not null
      and submitted_by_profile_id is not null
      and submitted_at is not null
      and confirmed_by_profile_id is null
      and confirmed_at is null
      and result_confirmation_method is null
    )
    or
    (
      result_status = 'confirmed'
      and result_outcome is not null
      and submitted_by_profile_id is not null
      and submitted_at is not null
      and confirmed_at is not null
      and (
        (result_confirmation_method = 'manual' and confirmed_by_profile_id is not null)
        or
        (result_confirmation_method = 'auto' and confirmed_by_profile_id is null)
      )
    )
    or
    (
      result_status = 'disputed'
      and result_outcome is not null
      and submitted_by_profile_id is not null
      and submitted_at is not null
      and confirmed_by_profile_id is null
      and confirmed_at is null
      and result_confirmation_method is null
    )
  ),
  constraint matches_result_outcome_check check (
    (result_outcome is null and winner_profile_id is null and loser_profile_id is null)
    or
    (
      result_outcome = 'win'
      and winner_profile_id is not null
      and loser_profile_id is not null
      and winner_profile_id <> loser_profile_id
    )
    or
    (
      result_outcome = 'draw'
      and winner_profile_id is null
      and loser_profile_id is null
    )
  ),
  constraint matches_manual_confirmer_check check (
    confirmed_by_profile_id is null
    or submitted_by_profile_id is null
    or confirmed_by_profile_id <> submitted_by_profile_id
  )
);

-- -----------------------------------------------------------------------------
-- Activity events
-- -----------------------------------------------------------------------------

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  sport_id smallint references public.sports(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint activity_events_type_check check (
    event_type in ('challenge_created', 'challenge_accepted', 'match_completed')
  )
);

-- -----------------------------------------------------------------------------
-- Future/inactive play-now scaffolding
-- -----------------------------------------------------------------------------

-- Retained for future work. The current product does not depend on a canonical
-- location catalog or an operational live-session workflow.
create table public.play_locations (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  name text not null,
  area text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null,
  location_name text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint live_sessions_status_check check (status in ('active', 'cancelled'))
);

-- -----------------------------------------------------------------------------
-- Per-sport rating foundation
-- -----------------------------------------------------------------------------

create table public.profile_sport_ratings (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sport_id smallint not null references public.sports(id) on delete restrict,
  rating integer not null default 1200,
  rated_matches_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, sport_id),
  constraint profile_sport_ratings_rating_positive check (rating >= 1),
  constraint profile_sport_ratings_match_count_nonnegative check (rated_matches_count >= 0)
);

create table public.match_rating_ledger (
  match_id uuid primary key references public.matches(id) on delete restrict,
  sport_id smallint not null references public.sports(id) on delete restrict,
  winner_profile_id uuid not null references public.profiles(id) on delete restrict,
  loser_profile_id uuid not null references public.profiles(id) on delete restrict,
  winner_rating_before integer not null,
  winner_rating_after integer not null,
  loser_rating_before integer not null,
  loser_rating_after integer not null,
  k_factor integer not null,
  applied_at timestamptz not null default timezone('utc', now()),
  constraint match_rating_ledger_distinct_profiles
    check (winner_profile_id <> loser_profile_id),
  constraint match_rating_ledger_values_positive check (
    winner_rating_before >= 1
    and winner_rating_after >= 1
    and loser_rating_before >= 1
    and loser_rating_after >= 1
    and k_factor > 0
  )
);

-- -----------------------------------------------------------------------------
-- Lifetime XP foundation
-- -----------------------------------------------------------------------------

create table public.profile_xp_ledger (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete restrict,
  participant_outcome text not null,
  amount integer not null,
  reason text not null default 'confirmed_match',
  awarded_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint profile_xp_ledger_profile_match_unique unique (profile_id, match_id),
  constraint profile_xp_ledger_outcome_check
    check (participant_outcome in ('win', 'loss', 'draw')),
  constraint profile_xp_ledger_reason_check check (reason = 'confirmed_match'),
  constraint profile_xp_ledger_amount_check check (
    (participant_outcome = 'win' and amount = 200)
    or (participant_outcome = 'loss' and amount = 100)
    or (participant_outcome = 'draw' and amount = 150)
  )
);

-- -----------------------------------------------------------------------------
-- Query-path indexes
-- -----------------------------------------------------------------------------

create index profiles_vancouver_area_idx
  on public.profiles (vancouver_area);
create index profiles_onboarding_location_idx
  on public.profiles (onboarding_completed, latitude, longitude)
  where onboarding_completed;

create index profile_sports_sport_active_skill_idx
  on public.profile_sports (sport_id, is_active, skill_level, profile_id);

create index challenges_opponent_status_scheduled_idx
  on public.challenges (opponent_profile_id, status, scheduled_at desc);
create index challenges_challenger_status_created_idx
  on public.challenges (challenger_profile_id, status, created_at desc);
create index challenges_pending_open_sport_scheduled_idx
  on public.challenges (sport_id, scheduled_at, created_at desc)
  where is_open and status = 'pending' and opponent_profile_id is null;

create index matches_challenger_result_history_idx
  on public.matches (challenger_profile_id, result_status, played_at desc, confirmed_at desc);
create index matches_opponent_result_history_idx
  on public.matches (opponent_profile_id, result_status, played_at desc, confirmed_at desc);
create index matches_pending_confirmation_deadline_idx
  on public.matches (result_confirmation_deadline_at)
  where result_status = 'pending_confirmation';
create index matches_confirmed_winner_idx
  on public.matches (winner_profile_id, confirmed_at desc)
  where result_status = 'confirmed' and result_outcome = 'win';
create index matches_confirmed_loser_idx
  on public.matches (loser_profile_id, confirmed_at desc)
  where result_status = 'confirmed' and result_outcome = 'win';

create index activity_events_actor_created_idx
  on public.activity_events (actor_profile_id, created_at desc);
create index activity_events_target_created_idx
  on public.activity_events (target_profile_id, created_at desc)
  where target_profile_id is not null;
create index activity_events_created_idx
  on public.activity_events (created_at desc);
create unique index activity_events_challenge_created_unique
  on public.activity_events (challenge_id)
  where event_type = 'challenge_created' and challenge_id is not null;
create unique index activity_events_challenge_accepted_unique
  on public.activity_events (challenge_id)
  where event_type = 'challenge_accepted' and challenge_id is not null;
create unique index activity_events_match_completed_unique
  on public.activity_events (match_id)
  where event_type = 'match_completed' and match_id is not null;

create index play_locations_sport_active_name_idx
  on public.play_locations (sport, is_active, name);
create index live_sessions_profile_status_updated_idx
  on public.live_sessions (profile_id, status, updated_at desc);
create index live_sessions_sport_status_expiry_idx
  on public.live_sessions (sport, status, expires_at);

create index profile_sport_ratings_sport_rating_idx
  on public.profile_sport_ratings (sport_id, rating desc, profile_id);
create index match_rating_ledger_sport_applied_idx
  on public.match_rating_ledger (sport_id, applied_at desc);

create index profile_xp_ledger_match_idx
  on public.profile_xp_ledger (match_id);
create index profile_xp_ledger_profile_awarded_idx
  on public.profile_xp_ledger (profile_id, awarded_at desc);

-- -----------------------------------------------------------------------------
-- Match/challenge integrity and progression functions
-- -----------------------------------------------------------------------------

create function private.validate_match_challenge_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_challenge public.challenges%rowtype;
begin
  select *
  into source_challenge
  from public.challenges
  where id = new.challenge_id;

  if not found then
    raise exception 'Challenge not found for match.';
  end if;

  if tg_op = 'INSERT' and source_challenge.status <> 'accepted' then
    raise exception 'Matches may only be created for accepted challenges.';
  end if;

  if new.sport_id <> source_challenge.sport_id
    or new.challenger_profile_id <> source_challenge.challenger_profile_id
    or new.opponent_profile_id is distinct from source_challenge.opponent_profile_id then
    raise exception 'Match participants and sport must match the source challenge.';
  end if;

  return new;
end;
$$;

create function private.handle_challenge_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.matches (
    challenge_id,
    sport_id,
    challenger_profile_id,
    opponent_profile_id,
    played_at,
    location_name,
    location_latitude,
    location_longitude
  )
  values (
    new.id,
    new.sport_id,
    new.challenger_profile_id,
    new.opponent_profile_id,
    new.scheduled_at,
    new.location_name,
    new.location_latitude,
    new.location_longitude
  )
  on conflict (challenge_id) do nothing;

  return new;
end;
$$;

create function private.handle_challenge_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenger_name text;
  opponent_name text;
  sport_name text;
begin
  select display_name into challenger_name
  from public.profiles where id = new.challenger_profile_id;

  select display_name into opponent_name
  from public.profiles where id = new.opponent_profile_id;

  select name into sport_name
  from public.sports where id = new.sport_id;

  if tg_op = 'INSERT' then
    insert into public.activity_events (
      actor_profile_id,
      target_profile_id,
      challenge_id,
      sport_id,
      event_type,
      metadata
    )
    values (
      new.challenger_profile_id,
      new.opponent_profile_id,
      new.id,
      new.sport_id,
      'challenge_created',
      jsonb_build_object(
        'actor_display_name', coalesce(challenger_name, 'Player'),
        'target_display_name', coalesce(opponent_name, 'Player'),
        'sport_name', coalesce(sport_name, 'Sport'),
        'challenge_location', new.location_name,
        'challenge_type', new.challenge_type,
        'stake_note', coalesce(new.stake_note, '')
      )
    )
    on conflict do nothing;
  elsif tg_op = 'UPDATE'
    and new.status = 'accepted'
    and old.status is distinct from 'accepted' then
    insert into public.activity_events (
      actor_profile_id,
      target_profile_id,
      challenge_id,
      sport_id,
      event_type,
      metadata
    )
    values (
      new.opponent_profile_id,
      new.challenger_profile_id,
      new.id,
      new.sport_id,
      'challenge_accepted',
      jsonb_build_object(
        'actor_display_name', coalesce(opponent_name, 'Player'),
        'target_display_name', coalesce(challenger_name, 'Player'),
        'sport_name', coalesce(sport_name, 'Sport'),
        'challenge_location', new.location_name,
        'challenge_type', new.challenge_type
      )
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create function private.recalculate_profile_stats(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmed_wins integer;
  confirmed_losses integer;
  confirmed_draws integer;
begin
  if target_profile_id is null then
    return;
  end if;

  insert into public.profile_stats (profile_id)
  values (target_profile_id)
  on conflict (profile_id) do nothing;

  select count(*) into confirmed_wins
  from public.matches
  where result_status = 'confirmed'
    and result_outcome = 'win'
    and winner_profile_id = target_profile_id;

  select count(*) into confirmed_losses
  from public.matches
  where result_status = 'confirmed'
    and result_outcome = 'win'
    and loser_profile_id = target_profile_id;

  select count(*) into confirmed_draws
  from public.matches
  where result_status = 'confirmed'
    and result_outcome = 'draw'
    and target_profile_id in (challenger_profile_id, opponent_profile_id);

  update public.profile_stats
  set
    wins = confirmed_wins,
    losses = confirmed_losses,
    draws = confirmed_draws,
    matches_played = confirmed_wins + confirmed_losses + confirmed_draws,
    updated_at = timezone('utc', now())
  where profile_id = target_profile_id;
end;
$$;

create function private.handle_match_result_change()
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

create function private.prevent_confirmed_match_mutation()
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

create function private.handle_match_completed_activity_event()
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

-- -----------------------------------------------------------------------------
-- Rating and XP trigger functions
-- -----------------------------------------------------------------------------

create function private.apply_rating_on_confirmed_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_profile_id uuid;
  second_profile_id uuid;
  first_rating integer;
  second_rating integer;
  winner_rating_before integer;
  loser_rating_before integer;
  winner_rating_after integer;
  loser_rating_after integer;
  winner_expected numeric;
  loser_expected numeric;
  applied_ledger_match_id uuid;
  updated_rating_row_count integer;
  k_factor constant integer := 32;
begin
  if new.result_outcome = 'draw' then
    return new;
  end if;

  if new.winner_profile_id is null
    or new.loser_profile_id is null
    or new.winner_profile_id = new.loser_profile_id then
    raise exception 'Confirmed wins require a distinct winner and loser for rating.';
  end if;

  insert into public.profile_sport_ratings (profile_id, sport_id)
  values
    (new.winner_profile_id, new.sport_id),
    (new.loser_profile_id, new.sport_id)
  on conflict (profile_id, sport_id) do nothing;

  if new.winner_profile_id < new.loser_profile_id then
    first_profile_id := new.winner_profile_id;
    second_profile_id := new.loser_profile_id;
  else
    first_profile_id := new.loser_profile_id;
    second_profile_id := new.winner_profile_id;
  end if;

  select rating into first_rating
  from public.profile_sport_ratings
  where profile_id = first_profile_id and sport_id = new.sport_id
  for update;

  select rating into second_rating
  from public.profile_sport_ratings
  where profile_id = second_profile_id and sport_id = new.sport_id
  for update;

  if first_rating is null or second_rating is null then
    raise exception 'Unable to load sport ratings for confirmed match.';
  end if;

  if new.winner_profile_id = first_profile_id then
    winner_rating_before := first_rating;
    loser_rating_before := second_rating;
  else
    winner_rating_before := second_rating;
    loser_rating_before := first_rating;
  end if;

  winner_expected := 1 / (
    1 + power(10::numeric, (loser_rating_before - winner_rating_before) / 400.0)
  );
  loser_expected := 1 / (
    1 + power(10::numeric, (winner_rating_before - loser_rating_before) / 400.0)
  );
  winner_rating_after := greatest(
    1,
    round(winner_rating_before + k_factor * (1 - winner_expected))::integer
  );
  loser_rating_after := greatest(
    1,
    round(loser_rating_before + k_factor * (0 - loser_expected))::integer
  );

  insert into public.match_rating_ledger (
    match_id,
    sport_id,
    winner_profile_id,
    loser_profile_id,
    winner_rating_before,
    winner_rating_after,
    loser_rating_before,
    loser_rating_after,
    k_factor
  )
  values (
    new.id,
    new.sport_id,
    new.winner_profile_id,
    new.loser_profile_id,
    winner_rating_before,
    winner_rating_after,
    loser_rating_before,
    loser_rating_after,
    k_factor
  )
  on conflict (match_id) do nothing
  returning match_id into applied_ledger_match_id;

  if applied_ledger_match_id is null then
    return new;
  end if;

  update public.profile_sport_ratings
  set
    rating = case
      when profile_id = new.winner_profile_id then winner_rating_after
      else loser_rating_after
    end,
    rated_matches_count = rated_matches_count + 1,
    updated_at = timezone('utc', now())
  where sport_id = new.sport_id
    and profile_id in (new.winner_profile_id, new.loser_profile_id);

  get diagnostics updated_rating_row_count = row_count;

  if updated_rating_row_count <> 2 then
    raise exception 'Unable to update sport ratings for confirmed match.';
  end if;

  return new;
end;
$$;

create function private.recalculate_profile_xp(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_profile_id is null then
    return;
  end if;

  insert into public.profile_stats (profile_id)
  values (target_profile_id)
  on conflict (profile_id) do nothing;

  update public.profile_stats
  set
    xp = (
      select coalesce(sum(ledger.amount), 0)
      from public.profile_xp_ledger as ledger
      where ledger.profile_id = target_profile_id
    ),
    updated_at = now()
  where profile_id = target_profile_id;
end;
$$;

create function private.award_match_xp_on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_profile_id uuid;
  second_profile_id uuid;
begin
  if new.result_status <> 'confirmed'
    or old.result_status is not distinct from 'confirmed' then
    return new;
  end if;

  if new.confirmed_at is null then
    raise exception 'Confirmed matches require a confirmation timestamp for XP.';
  end if;

  if new.result_outcome = 'win' then
    if new.winner_profile_id is null
      or new.loser_profile_id is null
      or new.winner_profile_id = new.loser_profile_id
      or new.winner_profile_id not in (
        new.challenger_profile_id, new.opponent_profile_id
      )
      or new.loser_profile_id not in (
        new.challenger_profile_id, new.opponent_profile_id
      ) then
      raise exception 'Confirmed win is invalid for XP.';
    end if;

    insert into public.profile_xp_ledger (
      profile_id,
      match_id,
      participant_outcome,
      amount,
      reason,
      awarded_at
    )
    values
      (new.winner_profile_id, new.id, 'win', 200, 'confirmed_match', new.confirmed_at),
      (new.loser_profile_id, new.id, 'loss', 100, 'confirmed_match', new.confirmed_at)
    on conflict (profile_id, match_id) do nothing;
  elsif new.result_outcome = 'draw' then
    if new.winner_profile_id is not null
      or new.loser_profile_id is not null
      or new.challenger_profile_id = new.opponent_profile_id then
      raise exception 'Confirmed draw is invalid for XP.';
    end if;

    insert into public.profile_xp_ledger (
      profile_id,
      match_id,
      participant_outcome,
      amount,
      reason,
      awarded_at
    )
    values
      (new.challenger_profile_id, new.id, 'draw', 150, 'confirmed_match', new.confirmed_at),
      (new.opponent_profile_id, new.id, 'draw', 150, 'confirmed_match', new.confirmed_at)
    on conflict (profile_id, match_id) do nothing;
  else
    raise exception 'Confirmed match outcome is unsupported for XP.';
  end if;

  if new.challenger_profile_id < new.opponent_profile_id then
    first_profile_id := new.challenger_profile_id;
    second_profile_id := new.opponent_profile_id;
  else
    first_profile_id := new.opponent_profile_id;
    second_profile_id := new.challenger_profile_id;
  end if;

  perform private.recalculate_profile_xp(first_profile_id);
  perform private.recalculate_profile_xp(second_profile_id);

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Canonical server-facing result RPCs
-- -----------------------------------------------------------------------------

create function public.submit_match_result_v2(
  target_match_id uuid,
  submitter_profile_id_param uuid,
  result_outcome_param public.match_result_outcome,
  winner_profile_id_param uuid default null,
  score_summary_param text default null,
  result_notes_param text default null
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_match public.matches%rowtype;
  current_challenge public.challenges%rowtype;
  resolved_loser_profile_id uuid;
  updated_match public.matches%rowtype;
begin
  select * into current_match
  from public.matches
  where id = target_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  select * into current_challenge
  from public.challenges
  where id = current_match.challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found for match';
  end if;

  if current_challenge.status <> 'accepted' then
    raise exception 'Only accepted challenges can move to result submission.';
  end if;

  if current_match.result_status <> 'pending_submission' then
    raise exception 'This match cannot accept a result from its current state.';
  end if;

  if submitter_profile_id_param not in (
    current_match.challenger_profile_id,
    current_match.opponent_profile_id
  ) then
    raise exception 'Only challenge participants can submit a result.';
  end if;

  if result_outcome_param = 'win' then
    if winner_profile_id_param is null
      or winner_profile_id_param not in (
        current_match.challenger_profile_id,
        current_match.opponent_profile_id
      ) then
      raise exception 'Winner must be a match participant.';
    end if;

    resolved_loser_profile_id := case
      when winner_profile_id_param = current_match.challenger_profile_id
        then current_match.opponent_profile_id
      else current_match.challenger_profile_id
    end;
  elsif result_outcome_param = 'draw' then
    if winner_profile_id_param is not null then
      raise exception 'Draw results cannot include a winner.';
    end if;
    resolved_loser_profile_id := null;
  else
    raise exception 'Unsupported result outcome.';
  end if;

  update public.matches
  set
    submitted_by_profile_id = submitter_profile_id_param,
    result_outcome = result_outcome_param,
    winner_profile_id = winner_profile_id_param,
    loser_profile_id = resolved_loser_profile_id,
    score_summary = score_summary_param,
    result_notes = result_notes_param,
    submitted_at = timezone('utc', now()),
    result_confirmation_deadline_at = timezone('utc', now()) + interval '24 hours',
    result_confirmation_method = null,
    confirmed_at = null,
    confirmed_by_profile_id = null,
    result_status = 'pending_confirmation',
    updated_at = timezone('utc', now())
  where id = target_match_id
  returning * into updated_match;

  return updated_match;
end;
$$;

create function public.confirm_match_result(
  match_id uuid,
  confirmer_profile_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_match public.matches%rowtype;
  current_challenge public.challenges%rowtype;
  updated_match public.matches%rowtype;
begin
  select * into current_match
  from public.matches
  where id = match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  select * into current_challenge
  from public.challenges
  where id = current_match.challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found for match';
  end if;

  if current_challenge.status <> 'accepted' then
    raise exception 'Only accepted challenges can be confirmed.';
  end if;

  if current_match.result_status = 'confirmed' then
    raise exception 'This result was already confirmed.';
  elsif current_match.result_status = 'disputed' then
    raise exception 'This result was disputed and cannot be confirmed.';
  elsif current_match.result_status <> 'pending_confirmation' then
    raise exception 'This result is not waiting for confirmation.';
  end if;

  if confirmer_profile_id not in (
    current_match.challenger_profile_id,
    current_match.opponent_profile_id
  ) then
    raise exception 'Only challenge participants can confirm a result.';
  end if;

  if current_match.submitted_by_profile_id = confirmer_profile_id then
    raise exception 'The submitting player cannot confirm their own result.';
  end if;

  if current_match.result_outcome is null then
    raise exception 'Submitted result is incomplete and cannot be confirmed.';
  end if;

  update public.matches
  set
    confirmed_by_profile_id = confirmer_profile_id,
    confirmed_at = timezone('utc', now()),
    result_status = 'confirmed',
    result_confirmation_method = 'manual',
    updated_at = timezone('utc', now())
  where id = match_id
  returning * into updated_match;

  return updated_match;
end;
$$;

create function public.reject_match_result(
  target_match_id uuid,
  rejecting_profile_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_match public.matches%rowtype;
  current_challenge public.challenges%rowtype;
  updated_match public.matches%rowtype;
begin
  select * into current_match
  from public.matches
  where id = target_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  select * into current_challenge
  from public.challenges
  where id = current_match.challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found for match';
  end if;

  if current_challenge.status <> 'accepted' then
    raise exception 'Only accepted challenges can have result disputes.';
  end if;

  if current_match.result_status = 'disputed' then
    raise exception 'This result was already disputed.';
  elsif current_match.result_status = 'confirmed' then
    raise exception 'A confirmed result can no longer be disputed.';
  elsif current_match.result_status = 'pending_submission' then
    raise exception 'Only submitted results can be rejected.';
  elsif current_match.result_status <> 'pending_confirmation' then
    raise exception 'This result is not waiting for confirmation.';
  end if;

  if rejecting_profile_id not in (
    current_match.challenger_profile_id,
    current_match.opponent_profile_id
  ) then
    raise exception 'Only challenge participants can reject a result.';
  end if;

  if current_match.submitted_by_profile_id = rejecting_profile_id then
    raise exception 'The submitting player cannot reject their own result.';
  end if;

  update public.matches
  set
    result_status = 'disputed',
    confirmed_by_profile_id = null,
    confirmed_at = null,
    result_confirmation_method = null,
    updated_at = timezone('utc', now())
  where id = target_match_id
  returning * into updated_match;

  if updated_match.id is null then
    raise exception 'Result dispute did not persist.';
  end if;

  return updated_match;
end;
$$;

create function public.auto_confirm_overdue_match_results(p_profile_id uuid default null)
returns setof public.matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  auto_confirmed_match public.matches%rowtype;
  current_timestamp_utc timestamptz := timezone('utc', now());
begin
  for auto_confirmed_match in
    update public.matches
    set
      result_status = 'confirmed',
      confirmed_at = current_timestamp_utc,
      confirmed_by_profile_id = null,
      result_confirmation_method = 'auto',
      updated_at = current_timestamp_utc
    where result_status = 'pending_confirmation'
      and coalesce(
        result_confirmation_deadline_at,
        submitted_at + interval '24 hours'
      ) <= current_timestamp_utc
      and submitted_at is not null
      and result_outcome is not null
      and (
        p_profile_id is null
        or p_profile_id in (challenger_profile_id, opponent_profile_id)
      )
    returning *
  loop
    return next auto_confirmed_match;
  end loop;

  return;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger validate_match_challenge_consistency
before insert or update of challenge_id, sport_id, challenger_profile_id, opponent_profile_id
on public.matches
for each row execute function private.validate_match_challenge_consistency();

create trigger create_match_on_accepted_challenge
after update on public.challenges
for each row
when (new.status = 'accepted' and old.status is distinct from 'accepted')
execute function private.handle_challenge_accepted();

create trigger activity_event_on_challenge_insert
after insert on public.challenges
for each row execute function private.handle_challenge_activity_event();

create trigger activity_event_on_challenge_accept
after update on public.challenges
for each row
when (new.status = 'accepted' and old.status is distinct from 'accepted')
execute function private.handle_challenge_activity_event();

create trigger prevent_confirmed_match_mutation
before update on public.matches
for each row execute function private.prevent_confirmed_match_mutation();

create trigger activity_event_on_match_completed
after update of result_status on public.matches
for each row
when (new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed')
execute function private.handle_match_completed_activity_event();

create trigger apply_rating_on_confirmed_match
after update of result_status on public.matches
for each row
when (new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed')
execute function private.apply_rating_on_confirmed_match();

create trigger award_xp_on_match_confirmed
after update of result_status on public.matches
for each row
when (new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed')
execute function private.award_match_xp_on_confirmation();

create trigger sync_challenge_and_stats_on_match_update
after update on public.matches
for each row execute function private.handle_match_result_change();

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------

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

-- Future/inactive sessions remain private to their owner until the feature is
-- intentionally activated and its discovery authorization is redesigned.
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

-- -----------------------------------------------------------------------------
-- Explicit least-privilege grants
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;

grant select on public.sports to anon, authenticated;
grant select on public.play_locations to anon, authenticated;

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

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

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

-- Trigger/reconciliation functions are owner-internal. Browser roles and the
-- service role do not invoke them directly.
revoke all on all functions in schema private
from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Avatar storage configuration
-- -----------------------------------------------------------------------------

-- Public reads are provided by the public bucket. Uploads are owned by the
-- upload-avatar Edge Function through service_role; no browser object-write
-- policy is created here.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Deterministic sports rows are intentionally separated from schema DDL.
-- Apply supabase/seeds/reference.sql after this baseline in a fresh environment.
