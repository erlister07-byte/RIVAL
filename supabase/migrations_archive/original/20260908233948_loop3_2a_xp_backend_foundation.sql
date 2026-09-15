begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

alter table public.profile_stats
add column if not exists xp bigint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'profile_stats_xp_nonnegative_check'
      and conrelid = 'public.profile_stats'::regclass
  ) then
    alter table public.profile_stats
    add constraint profile_stats_xp_nonnegative_check check (xp >= 0);
  end if;
end;
$$;

create table if not exists public.profile_xp_ledger (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete restrict,
  participant_outcome text not null,
  amount integer not null,
  reason text not null default 'confirmed_match',
  awarded_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint profile_xp_ledger_profile_match_key unique (profile_id, match_id),
  constraint profile_xp_ledger_participant_outcome_check
    check (participant_outcome in ('win', 'loss', 'draw')),
  constraint profile_xp_ledger_outcome_amount_check
    check (
      (participant_outcome = 'win' and amount = 200)
      or (participant_outcome = 'loss' and amount = 100)
      or (participant_outcome = 'draw' and amount = 150)
    ),
  constraint profile_xp_ledger_reason_check
    check (reason = 'confirmed_match')
);

create index if not exists profile_xp_ledger_match_id_idx
on public.profile_xp_ledger (match_id);

create index if not exists profile_xp_ledger_profile_awarded_at_idx
on public.profile_xp_ledger (profile_id, awarded_at desc);

alter table public.profile_xp_ledger enable row level security;

revoke all on table public.profile_xp_ledger from public, anon, authenticated;
revoke all on sequence public.profile_xp_ledger_id_seq from public, anon, authenticated;

grant select on table public.profile_xp_ledger to service_role;
grant select, usage on sequence public.profile_xp_ledger_id_seq to service_role;

create or replace function private.recalculate_profile_xp(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_profile_id is null then
    return;
  end if;

  insert into public.profile_stats (profile_id)
  values (target_profile_id)
  on conflict (profile_id) do nothing;

  update public.profile_stats
  set
    xp = (
      select coalesce(sum(ledger.amount), 0)
      from public.profile_xp_ledger as ledger
      where ledger.profile_id = target_profile_id
    ),
    updated_at = pg_catalog.now()
  where profile_id = target_profile_id;
end;
$$;

revoke all on function private.recalculate_profile_xp(uuid)
from public, anon, authenticated;

create or replace function private.award_match_xp_on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_profile_id uuid;
  second_profile_id uuid;
begin
  if new.result_status <> 'confirmed'
    or old.result_status is not distinct from 'confirmed' then
    return new;
  end if;

  if new.confirmed_at is null then
    raise exception 'Confirmed matches require a confirmation timestamp for XP.';
  end if;

  if new.result_outcome = 'win' then
    if new.winner_profile_id is null
      or new.loser_profile_id is null
      or new.winner_profile_id = new.loser_profile_id
      or new.winner_profile_id not in (new.challenger_profile_id, new.opponent_profile_id)
      or new.loser_profile_id not in (new.challenger_profile_id, new.opponent_profile_id) then
      raise exception 'Confirmed win is invalid for XP.';
    end if;

    insert into public.profile_xp_ledger (
      profile_id,
      match_id,
      participant_outcome,
      amount,
      reason,
      awarded_at
    )
    values
      (new.winner_profile_id, new.id, 'win', 200, 'confirmed_match', new.confirmed_at),
      (new.loser_profile_id, new.id, 'loss', 100, 'confirmed_match', new.confirmed_at)
    on conflict (profile_id, match_id) do nothing;
  elsif new.result_outcome = 'draw' then
    if new.winner_profile_id is not null
      or new.loser_profile_id is not null
      or new.challenger_profile_id = new.opponent_profile_id then
      raise exception 'Confirmed draw is invalid for XP.';
    end if;

    insert into public.profile_xp_ledger (
      profile_id,
      match_id,
      participant_outcome,
      amount,
      reason,
      awarded_at
    )
    values
      (new.challenger_profile_id, new.id, 'draw', 150, 'confirmed_match', new.confirmed_at),
      (new.opponent_profile_id, new.id, 'draw', 150, 'confirmed_match', new.confirmed_at)
    on conflict (profile_id, match_id) do nothing;
  else
    raise exception 'Confirmed match outcome is unsupported for XP.';
  end if;

  if new.challenger_profile_id < new.opponent_profile_id then
    first_profile_id := new.challenger_profile_id;
    second_profile_id := new.opponent_profile_id;
  else
    first_profile_id := new.opponent_profile_id;
    second_profile_id := new.challenger_profile_id;
  end if;

  perform private.recalculate_profile_xp(first_profile_id);
  perform private.recalculate_profile_xp(second_profile_id);

  return new;
end;
$$;

revoke all on function private.award_match_xp_on_confirmation()
from public, anon, authenticated;

lock table public.matches in share row exclusive mode;

drop trigger if exists award_xp_on_match_confirmed on public.matches;
create trigger award_xp_on_match_confirmed
after update of result_status on public.matches
for each row
when (
  old.result_status is distinct from 'confirmed'
  and new.result_status = 'confirmed'
)
execute function private.award_match_xp_on_confirmation();

do $$
begin
  if exists (
    select 1
    from public.matches
    where result_status = 'confirmed'
      and (
        confirmed_at is null
        or result_outcome is null
        or (
          result_outcome = 'win'
          and (
            winner_profile_id is null
            or loser_profile_id is null
            or winner_profile_id = loser_profile_id
            or winner_profile_id not in (challenger_profile_id, opponent_profile_id)
            or loser_profile_id not in (challenger_profile_id, opponent_profile_id)
          )
        )
        or (
          result_outcome = 'draw'
          and (winner_profile_id is not null or loser_profile_id is not null)
        )
      )
  ) then
    raise exception 'Confirmed match data is invalid for XP backfill.';
  end if;
end;
$$;

insert into public.profile_xp_ledger (
  profile_id,
  match_id,
  participant_outcome,
  amount,
  reason,
  awarded_at
)
select
  award.profile_id,
  award.match_id,
  award.participant_outcome,
  award.amount,
  'confirmed_match',
  award.confirmed_at
from (
  select
    m.id as match_id,
    m.winner_profile_id as profile_id,
    'win'::text as participant_outcome,
    200::integer as amount,
    m.confirmed_at
  from public.matches as m
  where m.result_status = 'confirmed'
    and m.result_outcome = 'win'

  union all

  select m.id, m.loser_profile_id, 'loss', 100, m.confirmed_at
  from public.matches as m
  where m.result_status = 'confirmed'
    and m.result_outcome = 'win'

  union all

  select m.id, m.challenger_profile_id, 'draw', 150, m.confirmed_at
  from public.matches as m
  where m.result_status = 'confirmed'
    and m.result_outcome = 'draw'

  union all

  select m.id, m.opponent_profile_id, 'draw', 150, m.confirmed_at
  from public.matches as m
  where m.result_status = 'confirmed'
    and m.result_outcome = 'draw'
) as award
on conflict (profile_id, match_id) do nothing;

insert into public.profile_stats (profile_id)
select profile.id
from public.profiles as profile
on conflict (profile_id) do nothing;

update public.profile_stats as stats
set
  xp = (
    select coalesce(sum(ledger.amount), 0)
    from public.profile_xp_ledger as ledger
    where ledger.profile_id = stats.profile_id
  ),
  updated_at = pg_catalog.now();

do $$
begin
  if exists (
    select 1
    from public.profile_stats as stats
    where stats.xp <> (
      select coalesce(sum(ledger.amount), 0)
      from public.profile_xp_ledger as ledger
      where ledger.profile_id = stats.profile_id
    )
  ) then
    raise exception 'Profile XP cache does not match the XP ledger.';
  end if;

  if exists (
    select 1
    from public.matches as m
    where m.result_status = 'confirmed'
      and (
        select count(*)
        from public.profile_xp_ledger as ledger
        where ledger.match_id = m.id
      ) <> 2
  ) then
    raise exception 'Confirmed matches must have exactly two XP awards.';
  end if;
end;
$$;

commit;
