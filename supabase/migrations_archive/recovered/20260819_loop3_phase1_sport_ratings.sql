create table public.profile_sport_ratings (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sport_id smallint not null references public.sports(id) on delete restrict,
  rating integer not null default 1200 check (rating >= 1),
  rated_matches_count integer not null default 0 check (rated_matches_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, sport_id)
);

create table public.match_rating_ledger (
  match_id uuid primary key references public.matches(id) on delete restrict,
  sport_id smallint not null references public.sports(id) on delete restrict,
  winner_profile_id uuid not null references public.profiles(id) on delete restrict,
  loser_profile_id uuid not null references public.profiles(id) on delete restrict,
  winner_rating_before integer not null check (winner_rating_before >= 1),
  winner_rating_after integer not null check (winner_rating_after >= 1),
  loser_rating_before integer not null check (loser_rating_before >= 1),
  loser_rating_after integer not null check (loser_rating_after >= 1),
  k_factor integer not null check (k_factor > 0),
  applied_at timestamptz not null default timezone('utc', now())
);

alter table public.profile_sport_ratings enable row level security;
alter table public.match_rating_ledger enable row level security;

revoke all on table public.profile_sport_ratings from public, anon, authenticated;
revoke all on table public.match_rating_ledger from public, anon, authenticated;

create or replace function public.handle_challenge_activity_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  challenger_name text;
  opponent_name text;
  sport_name text;
begin
  select display_name into challenger_name from public.profiles where id = new.challenger_profile_id;
  select display_name into opponent_name from public.profiles where id = new.opponent_profile_id;
  select name into sport_name from public.sports where id = new.sport_id;

  if tg_op = 'INSERT' then
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
      new.challenger_profile_id,
      new.opponent_profile_id,
      new.id,
      null,
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
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
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
      new.opponent_profile_id,
      new.challenger_profile_id,
      new.id,
      null,
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

create or replace function public.handle_match_completed_activity_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  winner_name text;
  loser_name text;
  sport_name text;
begin
  if new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed' then
    select display_name into winner_name from public.profiles where id = new.winner_profile_id;
    select display_name into loser_name from public.profiles where id = new.loser_profile_id;
    select name into sport_name from public.sports where id = new.sport_id;

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
      new.winner_profile_id,
      new.loser_profile_id,
      new.challenge_id,
      new.id,
      new.sport_id,
      'match_completed',
      jsonb_build_object(
        'actor_display_name', coalesce(winner_name, 'Player'),
        'target_display_name', coalesce(loser_name, 'Player'),
        'sport_name', coalesce(sport_name, 'Sport'),
        'score', coalesce(new.score_summary, ''),
        'challenge_location', new.location_name
      )
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.insert_activity_event(uuid, uuid, uuid, uuid, smallint, text, jsonb)
from public, anon, authenticated;

create or replace function public.prevent_confirmed_match_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.result_status = 'confirmed' and (
    old.challenge_id is distinct from new.challenge_id
    or old.sport_id is distinct from new.sport_id
    or old.challenger_profile_id is distinct from new.challenger_profile_id
    or old.opponent_profile_id is distinct from new.opponent_profile_id
    or old.played_at is distinct from new.played_at
    or old.location_name is distinct from new.location_name
    or old.result_status is distinct from new.result_status
    or old.submitted_by_profile_id is distinct from new.submitted_by_profile_id
    or old.submitted_at is distinct from new.submitted_at
    or old.winner_profile_id is distinct from new.winner_profile_id
    or old.loser_profile_id is distinct from new.loser_profile_id
    or old.score_summary is distinct from new.score_summary
    or old.result_notes is distinct from new.result_notes
    or old.confirmed_by_profile_id is distinct from new.confirmed_by_profile_id
    or old.confirmed_at is distinct from new.confirmed_at
    or old.result_confirmation_deadline_at is distinct from new.result_confirmation_deadline_at
    or old.result_confirmation_method is distinct from new.result_confirmation_method
    or old.is_disputed is distinct from new.is_disputed
    or old.auto_confirmed is distinct from new.auto_confirmed
  ) then
    raise exception 'Confirmed matches are immutable.';
  end if;

  return new;
end;
$$;

create trigger prevent_confirmed_match_mutation
before update on public.matches
for each row
execute function public.prevent_confirmed_match_mutation();

create or replace function public.apply_rating_on_confirmed_match()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
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
  if new.winner_profile_id is null
    or new.loser_profile_id is null
    or new.winner_profile_id = new.loser_profile_id then
    raise exception 'Confirmed matches require a winner and loser for rating.';
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

  select rating
  into first_rating
  from public.profile_sport_ratings
  where profile_id = first_profile_id
    and sport_id = new.sport_id
  for update;

  select rating
  into second_rating
  from public.profile_sport_ratings
  where profile_id = second_profile_id
    and sport_id = new.sport_id
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

  winner_expected := 1 / (1 + power(10::numeric, (loser_rating_before - winner_rating_before) / 400.0));
  loser_expected := 1 / (1 + power(10::numeric, (winner_rating_before - loser_rating_before) / 400.0));
  winner_rating_after := greatest(1, round(winner_rating_before + k_factor * (1 - winner_expected))::integer);
  loser_rating_after := greatest(1, round(loser_rating_before + k_factor * (0 - loser_expected))::integer);

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

create trigger apply_rating_on_confirmed_match
after update of result_status on public.matches
for each row
when (old.result_status is distinct from 'confirmed' and new.result_status = 'confirmed')
execute function public.apply_rating_on_confirmed_match();

revoke execute on function public.prevent_confirmed_match_mutation()
from public, anon, authenticated, service_role;
revoke execute on function public.apply_rating_on_confirmed_match()
from public, anon, authenticated, service_role;
