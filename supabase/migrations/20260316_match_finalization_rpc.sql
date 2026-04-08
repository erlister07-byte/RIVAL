create or replace function public.recalculate_profile_stats(target_profile_id uuid)
returns void
language plpgsql
as $$
declare
  confirmed_wins integer;
  confirmed_losses integer;
begin
  if target_profile_id is null then
    return;
  end if;

  insert into public.profile_stats (profile_id)
  values (target_profile_id)
  on conflict (profile_id) do nothing;

  select count(*)
  into confirmed_wins
  from public.matches
  where winner_profile_id = target_profile_id
    and result_status = 'confirmed';

  select count(*)
  into confirmed_losses
  from public.matches
  where loser_profile_id = target_profile_id
    and result_status = 'confirmed';

  update public.profile_stats
  set
    wins = confirmed_wins,
    losses = confirmed_losses,
    matches_played = confirmed_wins + confirmed_losses,
    updated_at = timezone('utc', now())
  where profile_id = target_profile_id;
end;
$$;

drop trigger if exists update_stats_on_confirmed_match on public.matches;
drop trigger if exists sync_challenge_and_stats_on_match_update on public.matches;

create or replace function public.handle_match_result_change()
returns trigger
language plpgsql
as $$
begin
  if (
    old.result_status is distinct from new.result_status or
    old.winner_profile_id is distinct from new.winner_profile_id or
    old.loser_profile_id is distinct from new.loser_profile_id
  ) then
    if new.result_status = 'confirmed' then
      update public.challenges
      set
        status = 'completed',
        completed_at = coalesce(new.confirmed_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
      where id = new.challenge_id;
    elsif old.result_status = 'confirmed' and new.result_status <> 'confirmed' then
      update public.challenges
      set
        status = 'accepted',
        completed_at = null,
        updated_at = timezone('utc', now())
      where id = new.challenge_id
        and status = 'completed';
    end if;

    perform public.recalculate_profile_stats(old.winner_profile_id);
    perform public.recalculate_profile_stats(old.loser_profile_id);
    perform public.recalculate_profile_stats(new.winner_profile_id);
    perform public.recalculate_profile_stats(new.loser_profile_id);
  end if;

  return new;
end;
$$;

create trigger sync_challenge_and_stats_on_match_update
after update on public.matches
for each row
execute function public.handle_match_result_change();

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

  if current_match.result_status <> 'pending_confirmation' then
    raise exception 'This result is not waiting for confirmation.';
  end if;

  if confirmer_profile_id not in (current_match.challenger_profile_id, current_match.opponent_profile_id) then
    raise exception 'Only challenge participants can confirm a result.';
  end if;

  if current_match.submitted_by_profile_id = confirmer_profile_id then
    raise exception 'The submitting player cannot confirm their own result.';
  end if;

  update public.matches
  set
    confirmed_by_profile_id = confirmer_profile_id,
    confirmed_at = timezone('utc', now()),
    result_status = 'confirmed',
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

  if current_match.result_status <> 'pending_confirmation' then
    raise exception 'Only submitted results can be rejected.';
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
    updated_at = timezone('utc', now())
  where id = target_match_id
  returning *
  into updated_match;

  return updated_match;
end;
$$;
