create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sport text not null,
  location_name text not null,
  latitude numeric null,
  longitude numeric null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint live_sessions_status_check check (status in ('active', 'cancelled', 'expired'))
);

create index if not exists live_sessions_profile_id_idx on public.live_sessions(profile_id);
create index if not exists live_sessions_sport_idx on public.live_sessions(sport);
create index if not exists live_sessions_status_idx on public.live_sessions(status);
create index if not exists live_sessions_expires_at_idx on public.live_sessions(expires_at);

drop trigger if exists set_updated_at_live_sessions on public.live_sessions;
create trigger set_updated_at_live_sessions
before update on public.live_sessions
for each row
execute function public.set_updated_at();

alter table public.live_sessions enable row level security;

drop policy if exists "authenticated users can read active live sessions" on public.live_sessions;
create policy "authenticated users can read active live sessions"
on public.live_sessions
for select
using (
  auth.role() = 'authenticated'
  and status = 'active'
  and expires_at > timezone('utc', now())
);

drop policy if exists "users can read their own live sessions" on public.live_sessions;
create policy "users can read their own live sessions"
on public.live_sessions
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = live_sessions.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);

drop policy if exists "users can create their own live sessions" on public.live_sessions;
create policy "users can create their own live sessions"
on public.live_sessions
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = live_sessions.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);

drop policy if exists "users can update their own live sessions" on public.live_sessions;
create policy "users can update their own live sessions"
on public.live_sessions
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = live_sessions.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = live_sessions.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);

drop policy if exists "users can delete their own live sessions" on public.live_sessions;
create policy "users can delete their own live sessions"
on public.live_sessions
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = live_sessions.profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);
