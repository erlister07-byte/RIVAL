create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  sport_id smallint references public.sports(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint activity_events_event_type_check check (
    event_type in ('challenge_created', 'challenge_accepted', 'match_completed')
  )
);

create index if not exists activity_events_created_at_idx
on public.activity_events (created_at desc);

create index if not exists activity_events_actor_profile_id_idx
on public.activity_events (actor_profile_id);

create index if not exists activity_events_target_profile_id_idx
on public.activity_events (target_profile_id);

create index if not exists activity_events_event_type_idx
on public.activity_events (event_type);

create unique index if not exists activity_events_unique_challenge_created_idx
on public.activity_events (challenge_id, event_type)
where challenge_id is not null and event_type = 'challenge_created';

create unique index if not exists activity_events_unique_challenge_accepted_idx
on public.activity_events (challenge_id, event_type)
where challenge_id is not null and event_type = 'challenge_accepted';

create unique index if not exists activity_events_unique_match_completed_idx
on public.activity_events (match_id, event_type)
where match_id is not null and event_type = 'match_completed';

create or replace function public.insert_activity_event(
  actor_profile_id_param uuid,
  target_profile_id_param uuid,
  challenge_id_param uuid,
  match_id_param uuid,
  sport_id_param smallint,
  event_type_param text,
  metadata_param jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
    actor_profile_id_param,
    target_profile_id_param,
    challenge_id_param,
    match_id_param,
    sport_id_param,
    event_type_param,
    coalesce(metadata_param, '{}'::jsonb)
  )
  on conflict do nothing;
end;
$$;

create or replace function public.handle_challenge_activity_event()
returns trigger
language plpgsql
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
    perform public.insert_activity_event(
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
    );
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.insert_activity_event(
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
    );
  end if;

  return new;
end;
$$;

drop trigger if exists activity_event_on_challenge_insert on public.challenges;
create trigger activity_event_on_challenge_insert
after insert on public.challenges
for each row
execute function public.handle_challenge_activity_event();

drop trigger if exists activity_event_on_challenge_accept on public.challenges;
create trigger activity_event_on_challenge_accept
after update on public.challenges
for each row
when (new.status = 'accepted')
execute function public.handle_challenge_activity_event();

create or replace function public.handle_match_completed_activity_event()
returns trigger
language plpgsql
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

    perform public.insert_activity_event(
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
    );
  end if;

  return new;
end;
$$;

drop trigger if exists activity_event_on_match_completed on public.matches;
create trigger activity_event_on_match_completed
after update on public.matches
for each row
when (new.result_status = 'confirmed')
execute function public.handle_match_completed_activity_event();

alter table public.activity_events enable row level security;

create policy "participants can read related activity events"
on public.activity_events
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id in (activity_events.actor_profile_id, activity_events.target_profile_id)
  )
);

create policy "users can create their own activity events"
on public.activity_events
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = activity_events.actor_profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);
