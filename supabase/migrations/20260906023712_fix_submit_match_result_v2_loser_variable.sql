create or replace function public.submit_match_result_v2(
  target_match_id uuid,
  submitter_profile_id_param uuid,
  result_outcome_param public.match_result_outcome,
  winner_profile_id_param uuid default null,
  score_summary_param text default null,
  result_notes_param text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  current_match public.matches%rowtype;
  current_challenge public.challenges%rowtype;
  resolved_loser_profile_id uuid;
  updated_match public.matches%rowtype;
begin
  select * into current_match from public.matches where id = target_match_id for update;
  if not found then raise exception 'Match not found'; end if;

  select * into current_challenge from public.challenges where id = current_match.challenge_id for update;
  if not found then raise exception 'Challenge not found for match'; end if;
  if current_challenge.status <> 'accepted' then raise exception 'Only accepted challenges can move to result submission.'; end if;
  if current_match.result_status <> 'pending_submission' then raise exception 'This match cannot accept a result from its current state.'; end if;
  if submitter_profile_id_param not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
    raise exception 'Only challenge participants can submit a result.';
  end if;

  if result_outcome_param = 'win' then
    if winner_profile_id_param is null or winner_profile_id_param not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
      raise exception 'Winner must be a match participant.';
    end if;
    resolved_loser_profile_id := case
      when winner_profile_id_param = current_match.challenger_profile_id then current_match.opponent_profile_id
      else current_match.challenger_profile_id
    end;
  elsif result_outcome_param = 'draw' then
    if winner_profile_id_param is not null then raise exception 'Draw results cannot include a winner.'; end if;
    resolved_loser_profile_id := null;
  else
    raise exception 'Unsupported result outcome.';
  end if;

  update public.matches
  set
    submitted_by_profile_id = submitter_profile_id_param,
    result_outcome = result_outcome_param,
    winner_profile_id = winner_profile_id_param,
    loser_profile_id = resolved_loser_profile_id,
    score_summary = score_summary_param,
    result_notes = result_notes_param,
    submitted_at = timezone('utc', now()),
    result_confirmation_deadline_at = timezone('utc', now()) + interval '24 hours',
    result_confirmation_method = null,
    confirmed_at = null,
    confirmed_by_profile_id = null,
    result_status = 'pending_confirmation',
    updated_at = timezone('utc', now())
  where id = target_match_id
  returning * into updated_match;

  return updated_match;
end;
$$;
