-- Optional profile-field migration pattern:
-- add nullable column -> backfill -> add default/check -> then make not null.
alter table public.profiles
add column if not exists availability_status text;

update public.profiles
set availability_status = 'unavailable'
where availability_status is null;

alter table public.profiles
alter column availability_status set default 'unavailable';

alter table public.profiles
alter column availability_status set not null;

alter table public.profiles
drop constraint if exists profiles_availability_status_check;

alter table public.profiles
add constraint profiles_availability_status_check
check (availability_status in ('now', 'today', 'this_week', 'unavailable'));

create index if not exists profiles_availability_status_idx
on public.profiles (availability_status);
