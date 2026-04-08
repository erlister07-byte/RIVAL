do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'sport_slug'
      and e.enumlabel = 'golf'
  ) then
    alter type public.sport_slug add value 'golf';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'sport_slug'
      and e.enumlabel = 'pickleball'
  ) then
    alter type public.sport_slug add value 'pickleball';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'sport_slug'
      and e.enumlabel = 'volleyball'
  ) then
    alter type public.sport_slug add value 'volleyball';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'sport_slug'
      and e.enumlabel = 'running'
  ) then
    alter type public.sport_slug add value 'running';
  end if;
end
$$;

insert into public.sports (id, slug, name, is_team_sport)
values
  (1, 'tennis', 'Tennis', false),
  (2, 'basketball', 'Basketball', true),
  (3, 'pickleball', 'Pickleball', false),
  (4, 'golf', 'Golf', false),
  (5, 'volleyball', 'Volleyball', true),
  (6, 'running', 'Running', false)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  is_team_sport = excluded.is_team_sport,
  updated_at = timezone('utc', now());
