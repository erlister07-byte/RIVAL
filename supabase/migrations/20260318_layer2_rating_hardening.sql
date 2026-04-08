alter table public.matches
  add column if not exists rating_applied boolean not null default false;

create index if not exists matches_confirmed_unrated_idx
on public.matches (confirmed_at desc)
where result_status = 'confirmed' and rating_applied = false;

alter table public.profiles
  drop constraint if exists profiles_rating_positive_check;

alter table public.profiles
  add constraint profiles_rating_range_check
  check (rating between 800 and 2000);

create or replace function public.apply_match_rating(match_id uuid)
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
  default_rating constant integer := 1200;
  min_rating constant integer := 800;
  max_rating constant integer := 2000;
begin
  select *
  into current_match
  from public.matches
  where id = match_id
  for update;

  if not found then
    raise exception 'Match not found';
  end if;

  if current_match.result_status <> 'confirmed' or current_match.rating_applied then
    return;
  end if;

  if current_match.winner_profile_id is null or current_match.loser_profile_id is null then
    return;
  end if;

  select coalesce(rating, default_rating)
  into winner_rating
  from public.profiles
  where id = current_match.winner_profile_id
  for update;

  select coalesce(rating, default_rating)
  into loser_rating
  from public.profiles
  where id = current_match.loser_profile_id
  for update;

  if winner_rating is null or loser_rating is null then
    return;
  end if;

  winner_expected := 1 / (1 + power(10::numeric, (loser_rating - winner_rating) / 400.0));
  loser_expected := 1 / (1 + power(10::numeric, (winner_rating - loser_rating) / 400.0));

  new_winner_rating := least(max_rating, greatest(min_rating, round(winner_rating + k_factor * (1 - winner_expected))));
  new_loser_rating := least(max_rating, greatest(min_rating, round(loser_rating + k_factor * (0 - loser_expected))));

  update public.profiles
  set rating = new_winner_rating
  where id = current_match.winner_profile_id;

  update public.profiles
  set rating = new_loser_rating
  where id = current_match.loser_profile_id;

  update public.matches
  set rating_applied = true
  where id = current_match.id
    and rating_applied = false;
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
