alter table public.matches
  add column if not exists result_confirmation_deadline_at timestamptz,
  add column if not exists result_confirmation_method text;

alter table public.matches
  drop constraint if exists matches_result_confirmation_method_check;

alter table public.matches
  add constraint matches_result_confirmation_method_check
  check (
    result_confirmation_method is null
    or result_confirmation_method in ('manual', 'auto')
  );

alter table public.matches
  drop constraint if exists matches_confirmed_result_check;

alter table public.matches
  add constraint matches_confirmed_result_check check (
    result_status <> 'confirmed'
    or
    (
      winner_profile_id is not null
      and loser_profile_id is not null
      and winner_profile_id <> loser_profile_id
      and (
        confirmed_by_profile_id is not null
        or result_confirmation_method = 'auto'
      )
    )
  );

create index if not exists matches_result_confirmation_deadline_idx
on public.matches (result_confirmation_deadline_at)
where result_status = 'pending_confirmation';

update public.matches
set result_confirmation_deadline_at = submitted_at + interval '24 hours'
where result_status = 'pending_confirmation'
  and submitted_at is not null
  and result_confirmation_deadline_at is null;

update public.matches
set result_confirmation_method = 'manual'
where result_status = 'confirmed'
  and confirmed_by_profile_id is not null
  and result_confirmation_method is null;

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
  submitted_timestamp timestamptz;
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

  if current_match.result_status = 'pending_confirmation' then
    raise exception 'This result is already waiting for confirmation.';
  elsif current_match.result_status = 'confirmed' then
    raise exception 'This result was already confirmed.';
  elsif current_match.result_status = 'disputed' then
    raise exception 'This result was disputed and must be resubmitted after review.';
  elsif current_match.result_status <> 'pending_submission' then
    raise exception 'This match cannot accept a result from its current state.';
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

  submitted_timestamp := timezone('utc', now());

  update public.matches
  set
    submitted_by_profile_id = submitter_profile_id_param,
    winner_profile_id = submit_match_result.winner_profile_id_param,
    loser_profile_id = submit_match_result.loser_profile_id_param,
    score_summary = score_summary_param,
    result_notes = result_notes_param,
    submitted_at = submitted_timestamp,
    result_confirmation_deadline_at = submitted_timestamp + interval '24 hours',
    result_confirmation_method = null,
    confirmed_at = null,
    confirmed_by_profile_id = null,
    result_status = 'pending_confirmation',
    updated_at = submitted_timestamp
  where id = target_match_id
  returning *
  into updated_match;

  if updated_match.id is null then
    raise exception 'Match result submission did not persist.';
  end if;

  return updated_match;
end;
$$;

create or replace function public.confirm_match_result(
  match_id uuid,
  confirmer_profile_id uuid
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
  where id = match_id
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
    raise exception 'Only accepted challenges can be confirmed.';
  end if;

  if current_match.result_status = 'confirmed' then
    raise exception 'This result was already confirmed.';
  elsif current_match.result_status = 'disputed' then
    raise exception 'This result was disputed and cannot be confirmed.';
  elsif current_match.result_status = 'pending_submission' then
    raise exception 'This match is still waiting for a submitted result.';
  elsif current_match.result_status <> 'pending_confirmation' then
    raise exception 'This result is not waiting for confirmation.';
  end if;

  if confirmer_profile_id not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
    raise exception 'Only challenge participants can confirm a result.';
  end if;

  if current_match.submitted_by_profile_id = confirmer_profile_id then
    raise exception 'The submitting player cannot confirm their own result.';
  end if;

  if current_match.winner_profile_id is null or current_match.loser_profile_id is null then
    raise exception 'Submitted result is incomplete and cannot be confirmed.';
  end if;

  update public.matches
  set
    confirmed_by_profile_id = confirmer_profile_id,
    confirmed_at = timezone('utc', now()),
    result_status = 'confirmed',
    result_confirmation_method = 'manual',
    updated_at = timezone('utc', now())
  where id = match_id
  returning *
  into updated_match;

  if updated_match.id is null then
    raise exception 'Match confirmation did not persist.';
  end if;

  update public.challenges
  set
    status = 'completed',
    completed_at = coalesce(updated_match.confirmed_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where id = updated_match.challenge_id
    and status <> 'completed';

  perform public.recalculate_profile_stats(updated_match.winner_profile_id);
  perform public.recalculate_profile_stats(updated_match.loser_profile_id);

  return updated_match;
end;
$$;

create or replace function public.reject_match_result(
  target_match_id uuid,
  rejecting_profile_id uuid
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
    raise exception 'Only accepted challenges can have result disputes.';
  end if;

  if current_match.result_status = 'disputed' then
    raise exception 'This result was already disputed.';
  elsif current_match.result_status = 'confirmed' then
    raise exception 'A confirmed result can no longer be disputed.';
  elsif current_match.result_status = 'pending_submission' then
    raise exception 'Only submitted results can be rejected.';
  elsif current_match.result_status <> 'pending_confirmation' then
    raise exception 'This result is not waiting for confirmation.';
  end if;

  if rejecting_profile_id not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
    raise exception 'Only challenge participants can reject a result.';
  end if;

  if current_match.submitted_by_profile_id = rejecting_profile_id then
    raise exception 'The submitting player cannot reject their own result.';
  end if;

  update public.matches
  set
    result_status = 'disputed',
    confirmed_by_profile_id = null,
    confirmed_at = null,
    result_confirmation_method = null,
    updated_at = timezone('utc', now())
  where id = target_match_id
  returning *
  into updated_match;

  if updated_match.id is null then
    raise exception 'Result dispute did not persist.';
  end if;

  return updated_match;
end;
$$;

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
  current_time timestamptz := timezone('utc', now());
begin
  for auto_confirmed_match in
    update public.matches
    set
      result_status = 'confirmed',
      confirmed_at = current_time,
      confirmed_by_profile_id = null,
      result_confirmation_method = 'auto',
      updated_at = current_time
    where result_status = 'pending_confirmation'
      and coalesce(result_confirmation_deadline_at, submitted_at + interval '24 hours') <= current_time
      and submitted_at is not null
      and winner_profile_id is not null
      and loser_profile_id is not null
      and (p_profile_id is null or p_profile_id in (challenger_profile_id, opponent_profile_id))
    returning *
  loop
    update public.challenges
    set
      status = 'completed',
      completed_at = coalesce(auto_confirmed_match.confirmed_at, current_time),
      updated_at = current_time
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
