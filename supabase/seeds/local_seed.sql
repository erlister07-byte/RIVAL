begin;

-- Remove previous local QA seed data so the script stays repeatable.
delete from public.matches
where challenge_id in (
  select id
  from public.challenges
  where challenger_profile_id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
  )
  or opponent_profile_id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
  )
);

delete from public.challenges
where challenger_profile_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
)
or opponent_profile_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

delete from public.profile_sports
where profile_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

delete from public.profile_stats
where profile_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

delete from public.profiles
where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
)
or firebase_uid in (
  'qa-riley-01',
  'qa-maya-02',
  'qa-jordan-03',
  'qa-sam-04'
);

insert into public.profiles (
  id,
  firebase_uid,
  email,
  display_name,
  vancouver_area,
  challenge_radius_km,
  latitude,
  longitude,
  onboarding_completed
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'qa-riley-01',
    'riley@rival.local',
    'Riley Park',
    'Downtown',
    12,
    49.2827,
    -123.1207,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'qa-maya-02',
    'maya@rival.local',
    'Maya Chen',
    'Kitsilano',
    8,
    49.2681,
    -123.1686,
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'qa-jordan-03',
    'jordan@rival.local',
    'Jordan Lee',
    'Mount Pleasant',
    15,
    49.2626,
    -123.1007,
    true
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'qa-sam-04',
    'sam@rival.local',
    'Sam Patel',
    'Burnaby',
    10,
    49.2488,
    -122.9805,
    true
  );

insert into public.profile_sports (
  id,
  profile_id,
  sport_id,
  skill_level,
  is_active
)
values
  ('51111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 1, 'intermediate', true),
  ('51111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 2, 'advanced', true),
  ('52222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 1, 'advanced', true),
  ('52222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 2, 'intermediate', true),
  ('53333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 2, 'competitive', true),
  ('54444444-4444-4444-4444-444444444441', '44444444-4444-4444-4444-444444444444', 1, 'beginner', true),
  ('54444444-4444-4444-4444-444444444442', '44444444-4444-4444-4444-444444444444', 2, 'intermediate', true)
on conflict (profile_id, sport_id) do update
set
  skill_level = excluded.skill_level,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

insert into public.profile_stats (profile_id, wins, losses, matches_played)
values
  ('11111111-1111-1111-1111-111111111111', 0, 0, 0),
  ('22222222-2222-2222-2222-222222222222', 0, 0, 0),
  ('33333333-3333-3333-3333-333333333333', 0, 0, 0),
  ('44444444-4444-4444-4444-444444444444', 0, 0, 0)
on conflict (profile_id) do update
set
  wins = 0,
  losses = 0,
  matches_played = 0,
  updated_at = timezone('utc', now());

-- Pending received challenge for Riley from Maya.
insert into public.challenges (
  id,
  sport_id,
  challenger_profile_id,
  opponent_profile_id,
  challenge_type,
  stake_note,
  scheduled_at,
  location_name,
  location_latitude,
  location_longitude,
  status,
  created_at,
  updated_at
)
values
  (
    '61111111-1111-1111-1111-111111111111',
    1,
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'casual',
    'Loser buys coffees',
    timezone('utc', now()) + interval '2 day',
    'Kits Beach Courts',
    49.2689,
    -123.1558,
    'pending',
    timezone('utc', now()) - interval '1 hour',
    timezone('utc', now()) - interval '1 hour'
  ),
  (
    '62222222-2222-2222-2222-222222222222',
    2,
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'practice',
    'First to 21',
    timezone('utc', now()) + interval '3 day',
    'David Lam Park',
    49.2732,
    -123.1270,
    'accepted',
    timezone('utc', now()) - interval '2 hour',
    timezone('utc', now()) - interval '2 hour'
  ),
  (
    '63333333-3333-3333-3333-333333333333',
    1,
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'ranked',
    null,
    timezone('utc', now()) - interval '5 day',
    'Granville Island Courts',
    49.2713,
    -123.1340,
    'accepted',
    timezone('utc', now()) - interval '6 day',
    timezone('utc', now()) - interval '6 day'
  );

-- The accepted challenge above creates a match through the trigger.
-- Seed one submitted result waiting for confirmation.
update public.matches
set
  result_status = 'pending_confirmation',
  submitted_by_profile_id = '11111111-1111-1111-1111-111111111111',
  winner_profile_id = '11111111-1111-1111-1111-111111111111',
  loser_profile_id = '33333333-3333-3333-3333-333333333333',
  score_summary = '21 - 18',
  result_notes = 'Tight game at sunset.',
  submitted_at = timezone('utc', now()) - interval '30 minute',
  updated_at = timezone('utc', now()) - interval '30 minute'
where challenge_id = '62222222-2222-2222-2222-222222222222';

-- Seed one confirmed result. Trigger updates stats and completes the challenge.
update public.matches
set
  result_status = 'confirmed',
  submitted_by_profile_id = '44444444-4444-4444-4444-444444444444',
  confirmed_by_profile_id = '11111111-1111-1111-1111-111111111111',
  winner_profile_id = '11111111-1111-1111-1111-111111111111',
  loser_profile_id = '44444444-4444-4444-4444-444444444444',
  score_summary = '6-3, 6-4',
  result_notes = 'Morning ladder match.',
  submitted_at = timezone('utc', now()) - interval '4 day',
  confirmed_at = timezone('utc', now()) - interval '4 day' + interval '20 minute',
  updated_at = timezone('utc', now()) - interval '4 day' + interval '20 minute'
where challenge_id = '63333333-3333-3333-3333-333333333333';

commit;
