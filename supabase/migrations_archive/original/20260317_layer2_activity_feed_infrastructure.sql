create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id),
  target_profile_id uuid references public.profiles(id),
  challenge_id uuid references public.challenges(id),
  match_id uuid references public.matches(id),
  sport_id smallint references public.sports(id),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_events_event_type_check check (
    event_type in ('challenge_created', 'challenge_accepted', 'match_completed')
  )
);

create index if not exists activity_events_created_at_idx
on public.activity_events (created_at);

create index if not exists activity_events_actor_profile_id_idx
on public.activity_events (actor_profile_id);

create index if not exists activity_events_target_profile_id_idx
on public.activity_events (target_profile_id);
