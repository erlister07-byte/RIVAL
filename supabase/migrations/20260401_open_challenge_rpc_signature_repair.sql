drop function if exists public.create_open_challenge(smallint, timestamptz, text, public.challenge_type, text);
drop function if exists public.create_open_challenge(integer, timestamptz, text, public.challenge_type, text);

create or replace function public.create_open_challenge(
  p_sport_id integer,
  p_scheduled_at timestamptz,
  p_location_name text,
  p_challenge_type public.challenge_type,
  p_stake_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
  created_challenge_id uuid;
begin
  select id
  into caller_profile_id
  from public.profiles
  where firebase_uid = public.requesting_firebase_uid();

  if caller_profile_id is null then
    raise exception 'Unable to resolve the current profile.';
  end if;

  insert into public.challenges (
    sport_id,
    challenger_profile_id,
    opponent_profile_id,
    challenge_type,
    stake_note,
    scheduled_at,
    location_name,
    status,
    is_open
  )
  values (
    p_sport_id,
    caller_profile_id,
    null,
    p_challenge_type,
    nullif(trim(coalesce(p_stake_note, '')), ''),
    p_scheduled_at,
    nullif(trim(coalesce(p_location_name, '')), ''),
    'pending',
    true
  )
  returning id into created_challenge_id;

  if created_challenge_id is null then
    raise exception 'Unable to create open challenge.';
  end if;

  return created_challenge_id;
end;
$$;

grant execute on function public.create_open_challenge(integer, timestamptz, text, public.challenge_type, text) to anon, authenticated;
