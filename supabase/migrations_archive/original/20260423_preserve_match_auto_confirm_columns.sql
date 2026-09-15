alter table public.matches
  add column if not exists is_disputed boolean not null default false,
  add column if not exists auto_confirmed boolean not null default false;

alter table public.matches
  alter column is_disputed set default false,
  alter column auto_confirmed set default false;
