alter table public.matches
  add column if not exists submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists winner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists loser_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists score_summary text,
  add column if not exists result_notes text,
  add column if not exists submitted_at timestamptz,
  add column if not exists confirmed_at timestamptz;

create or replace function public.submit_match_result(
  target_match_id uuid,
  submitter_profile_id_param uuid,
  winner_profile_id_param uuid,
  loser_profile_id_param uuid,
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
  updated_match public.matches%rowtype;
begin
  select *
  into current_match
  from public.matches
  where id = target_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  select *
  into current_challenge
  from public.challenges
  where id = current_match.challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found for match';
  end if;

  if current_challenge.status <> 'accepted' then
    raise exception 'Only accepted challenges can move to result submission.';
  end if;

  if current_match.result_status <> 'pending_submission' then
    raise exception 'This result has already been submitted.';
  end if;

  if submitter_profile_id_param not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
    raise exception 'Only challenge participants can submit a result.';
  end if;

  if winner_profile_id_param not in (current_match.challenger_profile_id, current_match.opponent_profile_id)
     or loser_profile_id_param not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
    raise exception 'Winner and loser must be challenge participants.';
  end if;

  if winner_profile_id_param = loser_profile_id_param then
    raise exception 'Winner and loser cannot be the same player.';
  end if;

  update public.matches
  set
    submitted_by_profile_id = submitter_profile_id_param,
    winner_profile_id = submit_match_result.winner_profile_id_param,
    loser_profile_id = submit_match_result.loser_profile_id_param,
    score_summary = score_summary_param,
    result_notes = result_notes_param,
    submitted_at = timezone('utc', now()),
    result_status = 'pending_confirmation',
    updated_at = timezone('utc', now())
  where id = target_match_id
  returning *
  into updated_match;

  return updated_match;
end;
$$;
