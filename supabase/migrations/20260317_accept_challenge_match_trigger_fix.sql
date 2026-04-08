create or replace function public.handle_challenge_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.matches (
      challenge_id,
      sport_id,
      challenger_profile_id,
      opponent_profile_id,
      played_at,
      location_name,
      location_latitude,
      location_longitude
    )
    values (
      new.id,
      new.sport_id,
      new.challenger_profile_id,
      new.opponent_profile_id,
      new.scheduled_at,
      new.location_name,
      new.location_latitude,
      new.location_longitude
    )
    on conflict (challenge_id) do nothing;
  end if;

  return new;
end;
$$;
