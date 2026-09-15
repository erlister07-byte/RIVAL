create unique index if not exists challenges_identity_tuple_idx
on public.challenges (id, sport_id, challenger_profile_id, opponent_profile_id);

create index if not exists challenges_received_pending_lookup_idx
on public.challenges (opponent_profile_id, scheduled_at desc)
where status = 'pending';

create index if not exists challenges_sent_active_lookup_idx
on public.challenges (challenger_profile_id, created_at desc)
where status in ('pending', 'accepted');

create index if not exists matches_pending_confirmation_lookup_idx
on public.matches (opponent_profile_id, submitted_at desc)
where result_status = 'pending_confirmation';

create index if not exists matches_challenge_result_status_idx
on public.matches (challenge_id, result_status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_challenge_identity_fkey'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_challenge_identity_fkey
      foreign key (challenge_id, sport_id, challenger_profile_id, opponent_profile_id)
      references public.challenges (id, sport_id, challenger_profile_id, opponent_profile_id)
      on delete cascade;
  end if;
end
$$;

create or replace function public.validate_match_linkage()
returns trigger
language plpgsql
as $$
declare
  linked_challenge public.challenges%rowtype;
begin
  select *
  into linked_challenge
  from public.challenges
  where id = new.challenge_id
    and sport_id = new.sport_id
    and challenger_profile_id = new.challenger_profile_id
    and opponent_profile_id = new.opponent_profile_id;

  if not found then
    raise exception 'Match must reference a challenge with matching sport and participants.';
  end if;

  if linked_challenge.status not in ('accepted', 'completed') then
    raise exception 'Match linkage requires an accepted or completed challenge.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_match_linkage_trigger on public.matches;

create trigger validate_match_linkage_trigger
before insert or update on public.matches
for each row
execute function public.validate_match_linkage();
