do $$
begin
  create type public.match_result_outcome as enum ('win', 'draw');
exception
  when duplicate_object then null;
end;
$$;

alter table public.matches
add column if not exists result_outcome public.match_result_outcome;

alter table public.profile_stats
add column if not exists draws integer not null default 0 check (draws >= 0);

-- Historical submitted results are all binary outcomes. Pending matches retain nulls.
update public.matches
set result_outcome = 'win'
where result_outcome is null
  and winner_profile_id is not null
  and loser_profile_id is not null;

update public.profile_stats
set
  draws = 0,
  matches_played = wins + losses;

alter table public.matches
drop constraint if exists matches_confirmed_result_check;

alter table public.matches
drop constraint if exists matches_result_outcome_check;

alter table public.matches
add constraint matches_result_outcome_check check (
  (result_status = 'pending_submission'
    and result_outcome is null
    and winner_profile_id is null
    and loser_profile_id is null)
  or
  (result_status in ('pending_confirmation', 'confirmed', 'disputed')
    and (
      (result_outcome = 'win'
        and winner_profile_id is not null
        and loser_profile_id is not null
        and winner_profile_id <> loser_profile_id)
      or
      (result_outcome = 'draw'
        and winner_profile_id is null
        and loser_profile_id is null)
    ))
);

alter table public.profile_stats
drop constraint if exists profile_stats_matches_played_check;

alter table public.profile_stats
add constraint profile_stats_matches_played_check
check (matches_played = wins + losses + draws);

create or replace function public.recalculate_profile_stats(target_profile_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  confirmed_wins integer;
  confirmed_losses integer;
  confirmed_draws integer;
begin
  if target_profile_id is null then
    return;
  end if;

  insert into public.profile_stats (profile_id)
  values (target_profile_id)
  on conflict (profile_id) do nothing;

  select count(*) into confirmed_wins
  from public.matches
  where result_status = 'confirmed'
    and result_outcome = 'win'
    and winner_profile_id = target_profile_id;

  select count(*) into confirmed_losses
  from public.matches
  where result_status = 'confirmed'
    and result_outcome = 'win'
    and loser_profile_id = target_profile_id;

  select count(*) into confirmed_draws
  from public.matches
  where result_status = 'confirmed'
    and result_outcome = 'draw'
    and target_profile_id in (challenger_profile_id, opponent_profile_id);

  update public.profile_stats
  set
    wins = confirmed_wins,
    losses = confirmed_losses,
    draws = confirmed_draws,
    matches_played = confirmed_wins + confirmed_losses + confirmed_draws,
    updated_at = timezone('utc', now())
  where profile_id = target_profile_id;
end;
$$;

create or replace function public.handle_match_result_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affects_confirmed_result boolean :=
    old.result_status = 'confirmed'
    or new.result_status = 'confirmed';
  result_fields_changed boolean :=
    old.result_status is distinct from new.result_status
    or old.result_outcome is distinct from new.result_outcome
    or old.winner_profile_id is distinct from new.winner_profile_id
    or old.loser_profile_id is distinct from new.loser_profile_id
    or old.challenger_profile_id is distinct from new.challenger_profile_id
    or old.opponent_profile_id is distinct from new.opponent_profile_id;
begin
  if old.result_status is distinct from new.result_status then
    if new.result_status = 'confirmed' then
      update public.challenges
      set
        status = 'completed',
        completed_at = coalesce(new.confirmed_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
      where id = new.challenge_id
        and status <> 'completed';
    elsif old.result_status = 'confirmed' then
      update public.challenges
      set
        status = 'accepted',
        completed_at = null,
        updated_at = timezone('utc', now())
      where id = new.challenge_id
        and status = 'completed';
    end if;
  end if;

  if affects_confirmed_result and result_fields_changed then
    perform public.recalculate_profile_stats(old.challenger_profile_id);
    perform public.recalculate_profile_stats(old.opponent_profile_id);
    perform public.recalculate_profile_stats(new.challenger_profile_id);
    perform public.recalculate_profile_stats(new.opponent_profile_id);
  end if;

  return new;
end;
$$;

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
  loser_profile_id uuid;
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
    loser_profile_id := case
      when winner_profile_id_param = current_match.challenger_profile_id then current_match.opponent_profile_id
      else current_match.challenger_profile_id
    end;
  elsif result_outcome_param = 'draw' then
    if winner_profile_id_param is not null then raise exception 'Draw results cannot include a winner.'; end if;
    loser_profile_id := null;
  else
    raise exception 'Unsupported result outcome.';
  end if;

  update public.matches
  set
    submitted_by_profile_id = submitter_profile_id_param,
    result_outcome = result_outcome_param,
    winner_profile_id = winner_profile_id_param,
    loser_profile_id = loser_profile_id,
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

-- Keep the existing service-role RPC callable by older win-only Edge Function deployments.
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
  expected_loser_profile_id uuid;
begin
  select * into current_match from public.matches where id = target_match_id for update;
  if not found then raise exception 'Match not found'; end if;

  if winner_profile_id_param not in (current_match.challenger_profile_id, current_match.opponent_profile_id)
    or loser_profile_id_param not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
    raise exception 'Winner and loser must be challenge participants.';
  end if;

  if winner_profile_id_param = loser_profile_id_param then
    raise exception 'Winner and loser cannot be the same player.';
  end if;

  expected_loser_profile_id := case
    when winner_profile_id_param = current_match.challenger_profile_id then current_match.opponent_profile_id
    else current_match.challenger_profile_id
  end;

  if loser_profile_id_param <> expected_loser_profile_id then
    raise exception 'Loser must be the other match participant.';
  end if;

  return public.submit_match_result_v2(
    target_match_id,
    submitter_profile_id_param,
    'win',
    winner_profile_id_param,
    score_summary_param,
    result_notes_param
  );
end;
$$;

revoke all on function public.submit_match_result_v2(uuid, uuid, public.match_result_outcome, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.submit_match_result_v2(uuid, uuid, public.match_result_outcome, uuid, text, text)
to service_role;

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
  select * into current_match from public.matches where id = match_id for update;
  if not found then raise exception 'Match not found'; end if;
  select * into current_challenge from public.challenges where id = current_match.challenge_id for update;
  if not found then raise exception 'Challenge not found for match'; end if;
  if current_challenge.status <> 'accepted' then raise exception 'Only accepted challenges can be confirmed.'; end if;
  if current_match.result_status = 'confirmed' then raise exception 'This result was already confirmed.'; end if;
  if current_match.result_status = 'disputed' then raise exception 'This result was disputed and cannot be confirmed.'; end if;
  if current_match.result_status <> 'pending_confirmation' then raise exception 'This result is not waiting for confirmation.'; end if;
  if confirmer_profile_id not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then raise exception 'Only challenge participants can confirm a result.'; end if;
  if current_match.submitted_by_profile_id = confirmer_profile_id then raise exception 'The submitting player cannot confirm their own result.'; end if;
  if current_match.result_outcome is null then raise exception 'Submitted result is incomplete and cannot be confirmed.'; end if;

  update public.matches
  set
    confirmed_by_profile_id = confirmer_profile_id,
    confirmed_at = timezone('utc', now()),
    result_status = 'confirmed',
    result_confirmation_method = 'manual',
    updated_at = timezone('utc', now())
  where id = match_id
  returning * into updated_match;

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
      and result_outcome is not null
      and (p_profile_id is null or p_profile_id in (challenger_profile_id, opponent_profile_id))
    returning *
  loop
    return next auto_confirmed_match;
  end loop;

  return;
end;
$$;

create or replace function public.handle_match_completed_activity_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_profile_id uuid;
  target_profile_id uuid;
  actor_name text;
  target_name text;
  sport_name text;
begin
  if new.result_status = 'confirmed' and old.result_status is distinct from 'confirmed' then
    actor_profile_id := case
      when new.result_outcome = 'win' then new.winner_profile_id
      else coalesce(new.submitted_by_profile_id, new.challenger_profile_id)
    end;
    target_profile_id := case
      when new.result_outcome = 'win' then new.loser_profile_id
      when actor_profile_id = new.challenger_profile_id then new.opponent_profile_id
      else new.challenger_profile_id
    end;

    select display_name into actor_name from public.profiles where id = actor_profile_id;
    select display_name into target_name from public.profiles where id = target_profile_id;
    select name into sport_name from public.sports where id = new.sport_id;

    perform public.insert_activity_event(
      actor_profile_id,
      target_profile_id,
      new.challenge_id,
      new.id,
      new.sport_id,
      'match_completed',
      jsonb_build_object(
        'actor_display_name', coalesce(actor_name, 'Player'),
        'target_display_name', coalesce(target_name, 'Player'),
        'sport_name', coalesce(sport_name, 'Sport'),
        'score', coalesce(new.score_summary, ''),
        'challenge_location', new.location_name,
        'result_outcome', new.result_outcome
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.apply_rating_on_confirmed_match()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  first_profile_id uuid;
  second_profile_id uuid;
  first_rating integer;
  second_rating integer;
  winner_rating_before integer;
  loser_rating_before integer;
  winner_rating_after integer;
  loser_rating_after integer;
  winner_expected numeric;
  loser_expected numeric;
  applied_ledger_match_id uuid;
  updated_rating_row_count integer;
  k_factor constant integer := 32;
begin
  if new.result_outcome = 'draw' then
    return new;
  end if;

  if new.winner_profile_id is null
    or new.loser_profile_id is null
    or new.winner_profile_id = new.loser_profile_id then
    raise exception 'Confirmed matches require a winner and loser for rating.';
  end if;

  insert into public.profile_sport_ratings (profile_id, sport_id)
  values
    (new.winner_profile_id, new.sport_id),
    (new.loser_profile_id, new.sport_id)
  on conflict (profile_id, sport_id) do nothing;

  if new.winner_profile_id < new.loser_profile_id then
    first_profile_id := new.winner_profile_id;
    second_profile_id := new.loser_profile_id;
  else
    first_profile_id := new.loser_profile_id;
    second_profile_id := new.winner_profile_id;
  end if;

  select rating into first_rating
  from public.profile_sport_ratings
  where profile_id = first_profile_id and sport_id = new.sport_id
  for update;

  select rating into second_rating
  from public.profile_sport_ratings
  where profile_id = second_profile_id and sport_id = new.sport_id
  for update;

  if first_rating is null or second_rating is null then
    raise exception 'Unable to load sport ratings for confirmed match.';
  end if;

  if new.winner_profile_id = first_profile_id then
    winner_rating_before := first_rating;
    loser_rating_before := second_rating;
  else
    winner_rating_before := second_rating;
    loser_rating_before := first_rating;
  end if;

  winner_expected := 1 / (1 + power(10::numeric, (loser_rating_before - winner_rating_before) / 400.0));
  loser_expected := 1 / (1 + power(10::numeric, (winner_rating_before - loser_rating_before) / 400.0));
  winner_rating_after := greatest(1, round(winner_rating_before + k_factor * (1 - winner_expected))::integer);
  loser_rating_after := greatest(1, round(loser_rating_before + k_factor * (0 - loser_expected))::integer);

  insert into public.match_rating_ledger (
    match_id, sport_id, winner_profile_id, loser_profile_id,
    winner_rating_before, winner_rating_after,
    loser_rating_before, loser_rating_after, k_factor
  )
  values (
    new.id, new.sport_id, new.winner_profile_id, new.loser_profile_id,
    winner_rating_before, winner_rating_after,
    loser_rating_before, loser_rating_after, k_factor
  )
  on conflict (match_id) do nothing
  returning match_id into applied_ledger_match_id;

  if applied_ledger_match_id is null then
    return new;
  end if;

  update public.profile_sport_ratings
  set
    rating = case when profile_id = new.winner_profile_id then winner_rating_after else loser_rating_after end,
    rated_matches_count = rated_matches_count + 1,
    updated_at = timezone('utc', now())
  where sport_id = new.sport_id
    and profile_id in (new.winner_profile_id, new.loser_profile_id);

  get diagnostics updated_rating_row_count = row_count;

  if updated_rating_row_count <> 2 then
    raise exception 'Unable to update sport ratings for confirmed match.';
  end if;

  return new;
end;
$$;

-- Rebuild every global record from confirmed results after the draw column backfill.
select public.recalculate_profile_stats(profile.id)
from public.profiles profile;
