create or replace function public.get_activity_feed_for_profile(
  target_profile_id uuid,
  feed_limit integer default 25
)
returns table (
  id uuid,
  actor_profile_id uuid,
  target_profile_id uuid,
  challenge_id uuid,
  match_id uuid,
  sport_slug public.sport_slug,
  event_type text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
begin
  select profiles.id
  into caller_profile_id
  from public.profiles
  where profiles.firebase_uid = public.requesting_firebase_uid();

  if caller_profile_id is null then
    raise exception 'Unauthorized activity feed access.';
  end if;

  if caller_profile_id <> target_profile_id then
    raise exception 'You can only read your own activity feed.';
  end if;

  return query
  select
    activity_events.id,
    activity_events.actor_profile_id,
    activity_events.target_profile_id,
    activity_events.challenge_id,
    activity_events.match_id,
    sports.slug as sport_slug,
    activity_events.event_type,
    activity_events.metadata,
    activity_events.created_at
  from public.activity_events
  left join public.sports
    on sports.id = activity_events.sport_id
  where
    activity_events.actor_profile_id = caller_profile_id
    or activity_events.target_profile_id = caller_profile_id
  order by activity_events.created_at desc
  limit least(greatest(coalesce(feed_limit, 25), 1), 100);
end;
$$;
