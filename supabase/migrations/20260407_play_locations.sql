create table if not exists public.play_locations (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  name text not null,
  area text null,
  latitude numeric null,
  longitude numeric null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists play_locations_sport_idx on public.play_locations(sport);
create index if not exists play_locations_is_active_idx on public.play_locations(is_active);
create index if not exists play_locations_name_idx on public.play_locations(name);

drop trigger if exists set_updated_at_play_locations on public.play_locations;
create trigger set_updated_at_play_locations
before update on public.play_locations
for each row
execute function public.set_updated_at();

alter table public.play_locations enable row level security;

drop policy if exists "authenticated users can read active play locations" on public.play_locations;
create policy "authenticated users can read active play locations"
on public.play_locations
for select
using (
  auth.role() = 'authenticated'
  and is_active = true
);

alter table public.live_sessions
  add column if not exists location_id uuid null references public.play_locations(id) on delete set null;

create index if not exists live_sessions_location_id_idx on public.live_sessions(location_id);

insert into public.play_locations (sport, name, area, latitude, longitude)
select 'pickleball', 'Kits Beach Courts', 'Kitsilano', 49.2734, -123.1554
where not exists (
  select 1 from public.play_locations where sport = 'pickleball' and name = 'Kits Beach Courts'
);

insert into public.play_locations (sport, name, area, latitude, longitude)
select 'pickleball', 'Queen Elizabeth Park Courts', 'Riley Park', 49.2417, -123.1122
where not exists (
  select 1 from public.play_locations where sport = 'pickleball' and name = 'Queen Elizabeth Park Courts'
);

insert into public.play_locations (sport, name, area, latitude, longitude)
select 'pickleball', 'David Lam Park Courts', 'Yaletown', 49.2717, -123.1248
where not exists (
  select 1 from public.play_locations where sport = 'pickleball' and name = 'David Lam Park Courts'
);

insert into public.play_locations (sport, name, area, latitude, longitude)
select 'pickleball', 'Trout Lake Community Centre', 'East Vancouver', 49.2557, -123.0617
where not exists (
  select 1 from public.play_locations where sport = 'pickleball' and name = 'Trout Lake Community Centre'
);

insert into public.play_locations (sport, name, area, latitude, longitude)
select 'pickleball', 'Mount Pleasant Community Centre', 'Mount Pleasant', 49.2638, -123.0968
where not exists (
  select 1 from public.play_locations where sport = 'pickleball' and name = 'Mount Pleasant Community Centre'
);
