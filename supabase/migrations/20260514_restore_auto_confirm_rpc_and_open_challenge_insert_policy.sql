create or replace function public.auto_confirm_overdue_match_results(
  p_profile_id uuid default null
)
returns setof public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  auto_confirmed_match public.matches%rowtype;
  current_timestamp_utc timestamptz := timezone('utc', now());
begin
  for auto_confirmed_match in
    update public.matches
    set
      result_status = 'confirmed',
      confirmed_at = current_timestamp_utc,
      confirmed_by_profile_id = null,
      result_confirmation_method = 'auto',
      updated_at = current_timestamp_utc
    where result_status = 'pending_confirmation'
      and coalesce(result_confirmation_deadline_at, submitted_at + interval '24 hours') <= current_timestamp_utc
      and submitted_at is not null
      and winner_profile_id is not null
      and loser_profile_id is not null
      and (p_profile_id is null or p_profile_id in (challenger_profile_id, opponent_profile_id))
    returning *
  loop
    update public.challenges
    set
      status = 'completed',
      completed_at = coalesce(auto_confirmed_match.confirmed_at, current_timestamp_utc),
      updated_at = current_timestamp_utc
    where id = auto_confirmed_match.challenge_id
      and status <> 'completed';

    perform public.recalculate_profile_stats(auto_confirmed_match.winner_profile_id);
    perform public.recalculate_profile_stats(auto_confirmed_match.loser_profile_id);

    return next auto_confirmed_match;
  end loop;

  return;
end;
$$;

grant execute on function public.auto_confirm_overdue_match_results(uuid) to authenticated;

drop policy if exists "challengers can create pending open challenges" on public.challenges;

create policy "challengers can create pending open challenges"
on public.challenges
for insert
with check (
  is_open = true
  and status = 'pending'
  and opponent_profile_id is null
  and exists (
    select 1
    from public.profiles p
    where p.id = challenges.challenger_profile_id
      and p.firebase_uid = public.requesting_firebase_uid()
  )
);
