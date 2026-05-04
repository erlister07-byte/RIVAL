create or replace function public.auto_confirm_overdue_match_results(profile_id uuid)
returns table(
  id uuid,
  challenge_id uuid,
  winner_profile_id uuid,
  loser_profile_id uuid,
  confirmed_at timestamp with time zone,
  auto_confirmed boolean
)
language plpgsql
as $function$
declare
  current_timestamp_utc timestamptz := now();
begin
  return query
  with overdue_matches as (
    select
      m.id,
      m.challenge_id,
      m.winner_profile_id,
      m.loser_profile_id
    from public.matches m
    where
      m.confirmed_at is null
      and m.result_status = 'pending_confirmation'
      and m.winner_profile_id = profile_id
      and coalesce(
        m.result_confirmation_deadline_at,
        m.submitted_at + interval '24 hours'
      ) <= current_timestamp_utc
      and coalesce(m.is_disputed, false) = false
  ),
  updated_matches as (
    update public.matches m
    set
      result_status = 'confirmed',
      confirmed_at = current_timestamp_utc,
      auto_confirmed = true,
      updated_at = current_timestamp_utc
    from overdue_matches om
    where m.id = om.id
    returning
      m.id,
      m.challenge_id,
      m.winner_profile_id,
      m.loser_profile_id,
      m.confirmed_at,
      m.auto_confirmed
  ),
  updated_challenges as (
    update public.challenges c
    set
      status = 'completed',
      completed_at = current_timestamp_utc,
      updated_at = current_timestamp_utc
    from updated_matches um
    where c.id = um.challenge_id
  )
  select
    um.id,
    um.challenge_id,
    um.winner_profile_id,
    um.loser_profile_id,
    um.confirmed_at,
    um.auto_confirmed
  from updated_matches um;
end;
$function$;
