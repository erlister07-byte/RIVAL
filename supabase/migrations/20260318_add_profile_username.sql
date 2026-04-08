alter table public.profiles
  add column if not exists username text;

update public.profiles
set username = display_name
where username is null;

alter table public.profiles
  alter column username set not null;

create index if not exists profiles_username_idx
on public.profiles (username);
