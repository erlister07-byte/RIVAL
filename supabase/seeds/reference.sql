-- Idempotently reassert deterministic reference data for a RIVAL database.
-- The baseline inserts these rows because later migrations validate their
-- fixed IDs before seed files run. Keep this seed for resets and drift repair.
-- This file intentionally contains no profiles, fixtures, activity, ratings, or XP.

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
