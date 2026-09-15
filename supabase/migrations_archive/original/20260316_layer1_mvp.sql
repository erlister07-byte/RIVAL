create extension if not exists pgcrypto;

create type public.sport_slug as enum ('tennis', 'basketball');
create type public.skill_level as enum ('beginner', 'intermediate', 'advanced', 'competitive');
create type public.challenge_status as enum ('pending', 'accepted', 'declined', 'completed', 'canceled');
create type public.challenge_type as enum ('casual', 'practice', 'ranked');
create type public.match_result_status as enum (
  'pending_submission',
  'pending_confirmation',
  'confirmed',
  'disputed'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.requesting_firebase_uid()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> 'firebase_uid',
    auth.jwt() -> 'app_metadata' ->> 'firebase_uid'
  );
$$;

create table if not exists public.sports (
  id smallint primary key,
  slug public.sport_slug not null unique,
  name text not null unique,
  is_team_sport boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text unique,
  display_name text not null,
  vancouver_area text not null,
  challenge_radius_km integer not null default 10 check (challenge_radius_km between 1 and 100),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_vancouver_area_check check (
    vancouver_area in (
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
    )
  )
);

create table if not exists public.profile_sports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sport_id smallint not null references public.sports(id) on delete restrict,
  skill_level public.skill_level not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_sports_unique_profile_sport unique (profile_id, sport_id)
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  sport_id smallint not null references public.sports(id) on delete restrict,
  challenger_profile_id uuid not null references public.profiles(id) on delete cascade,
  opponent_profile_id uuid not null references public.profiles(id) on delete cascade,
  challenge_type public.challenge_type not null,
  stake_note text,
  scheduled_at timestamptz not null,
  location_name text not null,
  location_latitude numeric(9, 6),
  location_longitude numeric(9, 6),
  status public.challenge_status not null default 'pending',
  accepted_at timestamptz,
  declined_at timestamptz,
  canceled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint challenges_distinct_profiles_check check (challenger_profile_id <> opponent_profile_id),
  constraint challenges_status_timestamps_check check (
    (status <> 'accepted' or accepted_at is not null) and
    (status <> 'declined' or declined_at is not null) and
    (status <> 'canceled' or canceled_at is not null) and
    (status <> 'completed' or completed_at is not null)
  )
);

create table if not exists public.matches (
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
  submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  confirmed_by_profile_id uuid references public.profiles(id) on delete set null,
  winner_profile_id uuid references public.profiles(id) on delete set null,
  loser_profile_id uuid references public.profiles(id) on delete set null,
  score_summary text,
  result_notes text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint matches_distinct_profiles_check check (challenger_profile_id <> opponent_profile_id),
  constraint matches_result_status_check check (
    (result_status = 'pending_submission' and submitted_at is null and confirmed_at is null) or
    (result_status = 'pending_confirmation' and submitted_at is not null) or
    (result_status = 'confirmed' and submitted_at is not null and confirmed_at is not null) or
    (result_status = 'disputed' and submitted_at is not null)
  ),
  constraint matches_actor_membership_check check (
    (submitted_by_profile_id is null or submitted_by_profile_id in (challenger_profile_id, opponent_profile_id)) and
    (confirmed_by_profile_id is null or confirmed_by_profile_id in (challenger_profile_id, opponent_profile_id)) and
    (winner_profile_id is null or winner_profile_id in (challenger_profile_id, opponent_profile_id)) and
    (loser_profile_id is null or loser_profile_id in (challenger_profile_id, opponent_profile_id))
  ),
  constraint matches_confirmed_result_check check (
    result_status <> 'confirmed' or
    (
      winner_profile_id is not null and
      loser_profile_id is not null and
      confirmed_by_profile_id is not null and
      winner_profile_id <> loser_profile_id
    )
  )
);

create table if not exists public.profile_stats (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  matches_played integer not null default 0 check (matches_played >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists sports_slug_idx on public.sports (slug);

create index if not exists profiles_firebase_uid_idx on public.profiles (firebase_uid);
create index if not exists profiles_vancouver_area_idx on public.profiles (vancouver_area);
create index if not exists profiles_onboarding_completed_idx on public.profiles (onboarding_completed);
create index if not exists profiles_location_idx on public.profiles (latitude, longitude);

create index if not exists profile_sports_profile_id_idx on public.profile_sports (profile_id);
create index if not exists profile_sports_sport_skill_idx on public.profile_sports (sport_id, skill_level);
create index if not exists profile_sports_active_idx on public.profile_sports (is_active) where is_active = true;

create index if not exists challenges_status_scheduled_idx on public.challenges (status, scheduled_at desc);
create index if not exists challenges_opponent_status_idx on public.challenges (opponent_profile_id, status, scheduled_at desc);
create index if not exists challenges_challenger_status_idx on public.challenges (challenger_profile_id, status, scheduled_at desc);
create index if not exists challenges_sport_status_idx on public.challenges (sport_id, status);

create index if not exists matches_result_status_idx on public.matches (result_status, played_at desc);
create index if not exists matches_challenger_idx on public.matches (challenger_profile_id, result_status);
create index if not exists matches_opponent_idx on public.matches (opponent_profile_id, result_status);
create index if not exists matches_winner_idx on public.matches (winner_profile_id);
create index if not exists matches_loser_idx on public.matches (loser_profile_id);
create index if not exists matches_confirmed_at_idx on public.matches (confirmed_at desc);

create trigger set_updated_at_sports
before update on public.sports
for each row
execute function public.set_updated_at();

create trigger set_updated_at_profiles
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_updated_at_profile_sports
before update on public.profile_sports
for each row
execute function public.set_updated_at();

create trigger set_updated_at_challenges
before update on public.challenges
for each row
execute function public.set_updated_at();

create trigger set_updated_at_matches
before update on public.matches
for each row
execute function public.set_updated_at();

create trigger set_updated_at_profile_stats
before update on public.profile_stats
for each row
execute function public.set_updated_at();

insert into public.sports (id, slug, name, is_team_sport)
values
  (1, 'tennis', 'Tennis', false),
  (2, 'basketball', 'Basketball', true)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  is_team_sport = excluded.is_team_sport,
  updated_at = timezone('utc', now());

create or replace function public.handle_challenge_accepted()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
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
  end if;

  return new;
end;
$$;

create trigger create_match_on_accepted_challenge
after update on public.challenges
for each row
when (new.status = 'accepted')
execute function public.handle_challenge_accepted();

create or replace function public.upsert_profile_stat_row(target_profile_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.profile_stats (profile_id)
  values (target_profile_id)
  on conflict (profile_id) do nothing;
end;
$$;

create or replace function public.handle_confirmed_match()
returns trigger
language plpgsql
as $$
begin
  if new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed' then
    perform public.upsert_profile_stat_row(new.winner_profile_id);
    perform public.upsert_profile_stat_row(new.loser_profile_id);

    update public.profile_stats
    set
      wins = wins + 1,
      matches_played = matches_played + 1,
      updated_at = timezone('utc', now())
    where profile_id = new.winner_profile_id;

    update public.profile_stats
    set
      losses = losses + 1,
      matches_played = matches_played + 1,
      updated_at = timezone('utc', now())
    where profile_id = new.loser_profile_id;

    update public.challenges
    set
      status = 'completed',
      completed_at = coalesce(new.confirmed_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
    where id = new.challenge_id;
  end if;

  return new;
end;
$$;

create trigger update_stats_on_confirmed_match
after update on public.matches
for each row
when (new.result_status = 'confirmed')
execute function public.handle_confirmed_match();

create or replace view public.recent_profile_matches as
select
  m.id,
  m.challenge_id,
  m.sport_id,
  s.slug as sport_slug,
  s.name as sport_name,
  m.challenger_profile_id,
  m.opponent_profile_id,
  m.winner_profile_id,
  m.loser_profile_id,
  m.score_summary,
  m.result_status,
  m.played_at,
  m.confirmed_at,
  m.location_name
from public.matches m
join public.sports s on s.id = m.sport_id
where m.result_status = 'confirmed';

alter table public.sports enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_sports enable row level security;
alter table public.challenges enable row level security;
alter table public.matches enable row level security;
alter table public.profile_stats enable row level security;

create policy "sports are readable by authenticated users"
on public.sports
for select
using (auth.role() = 'authenticated');

create policy "users can read visible profiles"
on public.profiles
for select
using (auth.role() = 'authenticated');

create policy "users can manage their own profile"
on public.profiles
for all
using (firebase_uid = public.requesting_firebase_uid())
with check (firebase_uid = public.requesting_firebase_uid());

create policy "users can read player sports"
on public.profile_sports
for select
using (auth.role() = 'authenticated');

create policy "users can manage their own player sports"
on public.profile_sports
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_sports.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_sports.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);

create policy "participants can read their challenges"
on public.challenges
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id in (challenges.challenger_profile_id, challenges.opponent_profile_id)
  )
);

create policy "challengers can create challenges"
on public.challenges
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = challenges.challenger_profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);

create policy "participants can update challenge status"
on public.challenges
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id in (challenges.challenger_profile_id, challenges.opponent_profile_id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id in (challenges.challenger_profile_id, challenges.opponent_profile_id)
  )
);

create policy "participants can read their matches"
on public.matches
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id in (matches.challenger_profile_id, matches.opponent_profile_id)
  )
);

create policy "participants can update their matches"
on public.matches
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id in (matches.challenger_profile_id, matches.opponent_profile_id)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id in (matches.challenger_profile_id, matches.opponent_profile_id)
  )
);

create policy "users can read their own stats"
on public.profile_stats
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = profile_stats.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);

comment on table public.challenges is
'Layer 1 keeps one challenger and one opponent per challenge. Team sports can be added later with challenge_side and team membership tables without changing challenge ids.';

comment on table public.matches is
'Matches are separated from challenges so results, disputes, feed events, achievements, and rivalry rollups can grow independently.';
