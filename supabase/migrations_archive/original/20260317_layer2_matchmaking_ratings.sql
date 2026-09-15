alter table public.profiles
  add column if not exists rating integer not null default 1200;

alter table public.profiles
  add constraint profiles_rating_positive_check
  check (rating > 0);

create index if not exists profiles_rating_idx
on public.profiles (rating);

create index if not exists profile_sports_sport_id_idx
on public.profile_sports (sport_id);

create or replace function public.apply_confirmed_match_rating_update(target_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_match public.matches%rowtype;
  winner_rating integer;
  loser_rating integer;
  winner_expected numeric;
  loser_expected numeric;
  new_winner_rating integer;
  new_loser_rating integer;
  k_factor constant integer := 32;
begin
  select *
  into current_match
  from public.matches
  where id = target_match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if current_match.result_status <> 'confirmed' then
    return;
  end if;

  if current_match.winner_profile_id is null or current_match.loser_profile_id is null then
    return;
  end if;

  select rating
  into winner_rating
  from public.profiles
  where id = current_match.winner_profile_id
  for update;

  select rating
  into loser_rating
  from public.profiles
  where id = current_match.loser_profile_id
  for update;

  if winner_rating is null or loser_rating is null then
    return;
  end if;

  winner_expected := 1 / (1 + power(10::numeric, (loser_rating - winner_rating) / 400.0));
  loser_expected := 1 / (1 + power(10::numeric, (winner_rating - loser_rating) / 400.0));

  new_winner_rating := greatest(1, round(winner_rating + k_factor * (1 - winner_expected)));
  new_loser_rating := greatest(1, round(loser_rating + k_factor * (0 - loser_expected)));

  update public.profiles
  set rating = new_winner_rating
  where id = current_match.winner_profile_id;

  update public.profiles
  set rating = new_loser_rating
  where id = current_match.loser_profile_id;
end;
$$;

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

      if old.result_status is distinct from 'confirmed' then
        perform public.apply_confirmed_match_rating_update(new.id);
      end if;
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
