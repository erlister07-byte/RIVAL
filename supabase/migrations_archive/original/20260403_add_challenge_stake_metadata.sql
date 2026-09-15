alter table public.challenges
  add column if not exists stake_type text not null default 'bragging_rights',
  add column if not exists stake_label text not null default 'Bragging Rights';
