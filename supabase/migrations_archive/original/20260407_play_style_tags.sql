alter table public.profiles
add column if not exists play_style_tags text[];

alter table public.profiles
drop constraint if exists profiles_play_style_tags_check;

alter table public.profiles
add constraint profiles_play_style_tags_check
check (
  play_style_tags is null
  or (
    cardinality(play_style_tags) <= 3
    and play_style_tags <@ array[
      'competitive',
      'casual',
      'beginner_friendly',
      'bragging_rights',
      'plays_for_coffee',
      'plays_for_drinks'
    ]::text[]
  )
);

create index if not exists profiles_play_style_tags_idx
on public.profiles using gin (play_style_tags);
