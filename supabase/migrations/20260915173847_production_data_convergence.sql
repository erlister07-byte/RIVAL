begin;

-- This forward-only convergence layer is deliberately safe for both the
-- canonical baseline and the audited production schema. Security hardening is
-- intentionally deferred to the following migration phase.

do $preconditions$
declare
  completed_open_count bigint;
  challenge_shape_violation_count bigint;
  canonical_challenge_shape_exists boolean;
begin
  if to_regclass('public.challenges') is null
    or to_regclass('public.matches') is null
    or to_regclass('public.profile_stats') is null
    or to_regclass('public.match_rating_ledger') is null
    or to_regclass('public.live_sessions') is null then
    raise exception 'H1 precondition failed: required application tables are missing.';
  end if;

  select exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conrelid = 'public.challenges'::regclass
      and constraint_record.conname = 'challenges_participant_shape_check'
  )
  into canonical_challenge_shape_exists;

  select count(*)
  into completed_open_count
  from public.challenges challenge_record
  where challenge_record.is_open is true
    and challenge_record.status = 'completed'
    and challenge_record.opponent_profile_id is not null
    and exists (
      select 1
      from public.matches match_record
      where match_record.challenge_id = challenge_record.id
    );

  if canonical_challenge_shape_exists then
    if completed_open_count <> 0 then
      raise exception
        'H1 precondition failed: canonical challenge constraint exists but % completed open rows remain.',
        completed_open_count;
    end if;
  elsif completed_open_count <> 5 then
    raise exception
      'H1 precondition failed: expected exactly 5 audited completed open challenges, found %.',
      completed_open_count;
  end if;

  if exists (
    select 1
    from public.challenges
    where is_open is null
  ) then
    raise exception 'H1 precondition failed: challenges.is_open contains NULL.';
  end if;

  select count(*)
  into challenge_shape_violation_count
  from public.challenges
  where not (
    (
      is_open
      and opponent_profile_id is null
      and status in ('pending', 'canceled')
    )
    or
    (
      not is_open
      and opponent_profile_id is not null
      and challenger_profile_id <> opponent_profile_id
    )
  );

  if challenge_shape_violation_count <> completed_open_count then
    raise exception
      'H1 precondition failed: found % challenge shape violations but % are audited completed open rows.',
      challenge_shape_violation_count,
      completed_open_count;
  end if;

  if exists (
    select 1
    from public.challenges
    where not (
      (status <> 'accepted' or accepted_at is not null)
      and (status <> 'declined' or declined_at is not null)
      and (status <> 'canceled' or canceled_at is not null)
      and (
        status <> 'completed'
        or (accepted_at is not null and completed_at is not null)
      )
    )
  ) then
    raise exception 'H1 precondition failed: challenge timestamp/status violations exist.';
  end if;

  if (select count(*) from public.sports where id = 5) <> 1
    or not exists (
      select 1
      from public.sports
      where id = 5
        and slug::text = 'volleyball'
        and name = 'Volleyball'
    ) then
    raise exception 'H1 precondition failed: sport ID 5 is not canonical Volleyball.';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'avatars'
      and name = 'avatars'
  ) then
    raise exception 'H1 precondition failed: avatars bucket is missing.';
  end if;

  if exists (
    select 1
    from storage.objects
    where bucket_id = 'avatars'
      and coalesce((metadata ->> 'size')::bigint, 0) > 5242880
  ) then
    raise exception 'H1 precondition failed: an avatar object exceeds 5 MiB.';
  end if;

  if exists (
    select 1
    from storage.objects
    where bucket_id = 'avatars'
      and coalesce(metadata ->> 'mimetype', '') not in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
      )
  ) then
    raise exception 'H1 precondition failed: an avatar object uses a noncanonical MIME type.';
  end if;

  if exists (
    select 1
    from public.matches
    where challenger_profile_id = opponent_profile_id
      or (
        submitted_by_profile_id is not null
        and submitted_by_profile_id not in (
          challenger_profile_id,
          opponent_profile_id
        )
      )
      or (
        confirmed_by_profile_id is not null
        and confirmed_by_profile_id not in (
          challenger_profile_id,
          opponent_profile_id
        )
      )
      or (
        winner_profile_id is not null
        and winner_profile_id not in (
          challenger_profile_id,
          opponent_profile_id
        )
      )
      or (
        loser_profile_id is not null
        and loser_profile_id not in (
          challenger_profile_id,
          opponent_profile_id
        )
      )
      or (
        winner_profile_id is not null
        and loser_profile_id is not null
        and winner_profile_id = loser_profile_id
      )
      or not (
        (
          result_outcome is null
          and winner_profile_id is null
          and loser_profile_id is null
        )
        or (
          result_outcome = 'win'
          and winner_profile_id is not null
          and loser_profile_id is not null
          and winner_profile_id <> loser_profile_id
        )
        or (
          result_outcome = 'draw'
          and winner_profile_id is null
          and loser_profile_id is null
        )
      )
      or not (
        (
          result_status = 'pending_submission'
          and result_outcome is null
          and submitted_by_profile_id is null
          and submitted_at is null
          and winner_profile_id is null
          and loser_profile_id is null
          and confirmed_by_profile_id is null
          and confirmed_at is null
          and result_confirmation_method is null
        )
        or (
          result_status = 'pending_confirmation'
          and result_outcome is not null
          and submitted_by_profile_id is not null
          and submitted_at is not null
          and confirmed_by_profile_id is null
          and confirmed_at is null
          and result_confirmation_method is null
        )
        or (
          result_status = 'confirmed'
          and result_outcome is not null
          and submitted_by_profile_id is not null
          and submitted_at is not null
          and confirmed_at is not null
          and (
            (
              result_confirmation_method = 'manual'
              and confirmed_by_profile_id is not null
            )
            or (
              result_confirmation_method = 'auto'
              and confirmed_by_profile_id is null
            )
          )
        )
        or (
          result_status = 'disputed'
          and result_outcome is not null
          and submitted_by_profile_id is not null
          and submitted_at is not null
          and confirmed_by_profile_id is null
          and confirmed_at is null
          and result_confirmation_method is null
        )
      )
      or (
        confirmed_by_profile_id is not null
        and submitted_by_profile_id is not null
        and confirmed_by_profile_id = submitted_by_profile_id
      )
      or (
        result_confirmation_method is not null
        and result_confirmation_method not in ('manual', 'auto')
      )
  ) then
    raise exception 'H1 precondition failed: proposed match constraints have violations.';
  end if;

  if exists (
    select 1
    from public.matches match_record
    join public.challenges challenge_record
      on challenge_record.id = match_record.challenge_id
    where match_record.sport_id <> challenge_record.sport_id
      or match_record.challenger_profile_id
        <> challenge_record.challenger_profile_id
      or match_record.opponent_profile_id
        is distinct from challenge_record.opponent_profile_id
  ) then
    raise exception 'H1 precondition failed: match/challenge identity mismatches exist.';
  end if;

  if exists (
    select 1
    from public.profile_stats
    where wins < 0
      or losses < 0
      or matches_played < 0
  ) then
    raise exception 'H1 precondition failed: negative profile record values exist.';
  end if;

  if exists (
    select 1
    from public.match_rating_ledger
    where winner_profile_id = loser_profile_id
  ) then
    raise exception 'H1 precondition failed: rating ledger contains identical participants.';
  end if;

  if exists (
    select 1
    from public.live_sessions
    where status not in ('active', 'cancelled')
  ) then
    raise exception 'H1 precondition failed: live_sessions contains an invalid status.';
  end if;
end
$preconditions$;

-- Normalize only the audited completed open-challenge shape.
update public.challenges challenge_record
set is_open = false
where challenge_record.is_open is true
  and challenge_record.status = 'completed'
  and challenge_record.opponent_profile_id is not null
  and exists (
    select 1
    from public.matches match_record
    where match_record.challenge_id = challenge_record.id
  );

alter table public.challenges
  alter column is_open set not null;

do $challenge_constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.challenges'::regclass
      and conname = 'challenges_participant_shape_check'
  ) then
    alter table public.challenges
      add constraint challenges_participant_shape_check check (
        (
          is_open
          and opponent_profile_id is null
          and status in ('pending', 'canceled')
        )
        or
        (
          not is_open
          and opponent_profile_id is not null
          and challenger_profile_id <> opponent_profile_id
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.challenges'::regclass
      and conname = 'challenges_status_timestamps_check'
  ) then
    alter table public.challenges
      add constraint challenges_status_timestamps_check check (
        (status <> 'accepted' or accepted_at is not null)
        and (status <> 'declined' or declined_at is not null)
        and (status <> 'canceled' or canceled_at is not null)
        and (
          status <> 'completed'
          or (accepted_at is not null and completed_at is not null)
        )
      );
  end if;
end
$challenge_constraints$;

update public.sports
set is_team_sport = true
where id = 5
  and slug::text = 'volleyball'
  and name = 'Volleyball'
  and is_team_sport is distinct from true;

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]::text[]
where id = 'avatars'
  and name = 'avatars';

alter table public.matches
  add column if not exists location_latitude numeric(9, 6),
  add column if not exists location_longitude numeric(9, 6);

-- Production currently uses a public trigger helper, while the canonical
-- baseline already uses the private helper. Update only the helper that exists;
-- do not move legacy functions between schemas in H1.
do $match_creation_coordinates$
begin
  if to_regprocedure('public.handle_challenge_accepted()') is not null then
    execute $function$
      create or replace function public.handle_challenge_accepted()
      returns trigger
      language plpgsql
      as $body$
      begin
        insert into public.matches (
          challenge_id,
          sport_id,
          challenger_profile_id,
          opponent_profile_id,
          played_at,
          location_name,
          location_latitude,
          location_longitude
        )
        values (
          new.id,
          new.sport_id,
          new.challenger_profile_id,
          new.opponent_profile_id,
          new.scheduled_at,
          new.location_name,
          new.location_latitude,
          new.location_longitude
        )
        on conflict (challenge_id) do nothing;

        return new;
      end;
      $body$
    $function$;
  elsif to_regprocedure('private.handle_challenge_accepted()') is null then
    raise exception 'H1 precondition failed: no challenge-to-match trigger helper exists.';
  end if;
end
$match_creation_coordinates$;

create or replace function private.validate_match_challenge_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  source_challenge public.challenges%rowtype;
begin
  select *
  into source_challenge
  from public.challenges
  where id = new.challenge_id;

  if not found then
    raise exception 'Challenge not found for match.';
  end if;

  if tg_op = 'INSERT' and source_challenge.status <> 'accepted' then
    raise exception 'Matches may only be created for accepted challenges.';
  end if;

  if new.sport_id <> source_challenge.sport_id
    or new.challenger_profile_id <> source_challenge.challenger_profile_id
    or new.opponent_profile_id is distinct from source_challenge.opponent_profile_id then
    raise exception 'Match participants and sport must match the source challenge.';
  end if;

  return new;
end;
$function$;

revoke all on function private.validate_match_challenge_consistency()
from public, anon, authenticated, service_role;

do $match_consistency_trigger$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.matches'::regclass
      and tgname = 'validate_match_challenge_consistency'
      and not tgisinternal
  ) then
    create trigger validate_match_challenge_consistency
    before insert or update of
      challenge_id,
      sport_id,
      challenger_profile_id,
      opponent_profile_id
    on public.matches
    for each row
    execute function private.validate_match_challenge_consistency();
  end if;
end
$match_consistency_trigger$;

do $match_constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_distinct_participants_check'
  ) then
    alter table public.matches
      add constraint matches_distinct_participants_check
      check (challenger_profile_id <> opponent_profile_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_actor_membership_check'
  ) then
    alter table public.matches
      add constraint matches_actor_membership_check check (
        (
          submitted_by_profile_id is null
          or submitted_by_profile_id in (
            challenger_profile_id,
            opponent_profile_id
          )
        )
        and (
          confirmed_by_profile_id is null
          or confirmed_by_profile_id in (
            challenger_profile_id,
            opponent_profile_id
          )
        )
        and (
          winner_profile_id is null
          or winner_profile_id in (
            challenger_profile_id,
            opponent_profile_id
          )
        )
        and (
          loser_profile_id is null
          or loser_profile_id in (
            challenger_profile_id,
            opponent_profile_id
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname in (
        'matches_confirmation_method_check',
        'matches_result_confirmation_method_check'
      )
  ) then
    alter table public.matches
      add constraint matches_confirmation_method_check
      check (
        result_confirmation_method is null
        or result_confirmation_method in ('manual', 'auto')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_result_state_check'
  ) then
    alter table public.matches
      add constraint matches_result_state_check check (
        (
          result_status = 'pending_submission'
          and result_outcome is null
          and submitted_by_profile_id is null
          and submitted_at is null
          and winner_profile_id is null
          and loser_profile_id is null
          and confirmed_by_profile_id is null
          and confirmed_at is null
          and result_confirmation_method is null
        )
        or (
          result_status = 'pending_confirmation'
          and result_outcome is not null
          and submitted_by_profile_id is not null
          and submitted_at is not null
          and confirmed_by_profile_id is null
          and confirmed_at is null
          and result_confirmation_method is null
        )
        or (
          result_status = 'confirmed'
          and result_outcome is not null
          and submitted_by_profile_id is not null
          and submitted_at is not null
          and confirmed_at is not null
          and (
            (
              result_confirmation_method = 'manual'
              and confirmed_by_profile_id is not null
            )
            or (
              result_confirmation_method = 'auto'
              and confirmed_by_profile_id is null
            )
          )
        )
        or (
          result_status = 'disputed'
          and result_outcome is not null
          and submitted_by_profile_id is not null
          and submitted_at is not null
          and confirmed_by_profile_id is null
          and confirmed_at is null
          and result_confirmation_method is null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_result_outcome_check'
  ) then
    alter table public.matches
      add constraint matches_result_outcome_check check (
        (
          result_outcome is null
          and winner_profile_id is null
          and loser_profile_id is null
        )
        or (
          result_outcome = 'win'
          and winner_profile_id is not null
          and loser_profile_id is not null
          and winner_profile_id <> loser_profile_id
        )
        or (
          result_outcome = 'draw'
          and winner_profile_id is null
          and loser_profile_id is null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_manual_confirmer_check'
  ) then
    alter table public.matches
      add constraint matches_manual_confirmer_check check (
        confirmed_by_profile_id is null
        or submitted_by_profile_id is null
        or confirmed_by_profile_id <> submitted_by_profile_id
      );
  end if;
end
$match_constraints$;

do $profile_stats_constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_stats'::regclass
      and conname = 'profile_stats_wins_nonnegative'
  ) then
    alter table public.profile_stats
      add constraint profile_stats_wins_nonnegative check (wins >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_stats'::regclass
      and conname = 'profile_stats_losses_nonnegative'
  ) then
    alter table public.profile_stats
      add constraint profile_stats_losses_nonnegative check (losses >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_stats'::regclass
      and conname = 'profile_stats_matches_played_nonnegative'
  ) then
    alter table public.profile_stats
      add constraint profile_stats_matches_played_nonnegative
      check (matches_played >= 0);
  end if;
end
$profile_stats_constraints$;

do $rating_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.match_rating_ledger'::regclass
      and conname = 'match_rating_ledger_distinct_profiles'
  ) then
    alter table public.match_rating_ledger
      add constraint match_rating_ledger_distinct_profiles
      check (winner_profile_id <> loser_profile_id);
  end if;
end
$rating_constraint$;

do $live_session_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.live_sessions'::regclass
      and conname = 'live_sessions_status_check'
  ) then
    alter table public.live_sessions
      add constraint live_sessions_status_check
      check (status in ('active', 'cancelled'));
  end if;
end
$live_session_constraint$;

do $final_assertions$
begin
  if exists (
    select 1
    from public.challenges
    where not (
      (
        is_open
        and opponent_profile_id is null
        and status in ('pending', 'canceled')
      )
      or (
        not is_open
        and opponent_profile_id is not null
        and challenger_profile_id <> opponent_profile_id
      )
    )
  ) then
    raise exception 'H1 final assertion failed: challenge shape is not canonical.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'challenges'
      and column_name = 'is_open'
      and is_nullable <> 'NO'
  ) then
    raise exception 'H1 final assertion failed: challenges.is_open is nullable.';
  end if;

  if not exists (
    select 1
    from public.sports
    where id = 5
      and slug::text = 'volleyball'
      and name = 'Volleyball'
      and is_team_sport is true
  ) then
    raise exception 'H1 final assertion failed: Volleyball is not a team sport.';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'avatars'
      and name = 'avatars'
      and public is true
      and file_size_limit = 5242880
      and allowed_mime_types = array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
      ]::text[]
  ) then
    raise exception 'H1 final assertion failed: avatars bucket configuration is not canonical.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'location_latitude'
      and data_type = 'numeric'
      and numeric_precision = 9
      and numeric_scale = 6
      and is_nullable = 'YES'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'location_longitude'
      and data_type = 'numeric'
      and numeric_precision = 9
      and numeric_scale = 6
      and is_nullable = 'YES'
  ) then
    raise exception 'H1 final assertion failed: canonical match coordinates are missing.';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_record
    join pg_proc function_record
      on function_record.oid = trigger_record.tgfoid
    where trigger_record.tgrelid = 'public.challenges'::regclass
      and trigger_record.tgname = 'create_match_on_accepted_challenge'
      and not trigger_record.tgisinternal
      and pg_get_functiondef(function_record.oid) like '%location_latitude%'
      and pg_get_functiondef(function_record.oid) like '%location_longitude%'
  ) then
    raise exception 'H1 final assertion failed: match creation does not carry coordinates.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.matches'::regclass
      and tgname = 'validate_match_challenge_consistency'
      and not tgisinternal
  ) then
    raise exception 'H1 final assertion failed: match/challenge consistency trigger is missing.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_distinct_participants_check'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_actor_membership_check'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_result_state_check'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_result_outcome_check'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_manual_confirmer_check'
  ) then
    raise exception 'H1 final assertion failed: canonical match integrity is incomplete.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_stats'::regclass
      and conname = 'profile_stats_wins_nonnegative'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_stats'::regclass
      and conname = 'profile_stats_losses_nonnegative'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_stats'::regclass
      and conname = 'profile_stats_matches_played_nonnegative'
  ) then
    raise exception 'H1 final assertion failed: profile_stats nonnegative checks are incomplete.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.match_rating_ledger'::regclass
      and conname = 'match_rating_ledger_distinct_profiles'
  ) then
    raise exception 'H1 final assertion failed: rating participant constraint is missing.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.live_sessions'::regclass
      and conname = 'live_sessions_status_check'
  ) then
    raise exception 'H1 final assertion failed: live_sessions status constraint is missing.';
  end if;

  -- H1 must preserve the audited nullable-auth legacy identities.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'auth_user_id'
      and is_nullable = 'YES'
  ) and (select count(*) from public.profiles where auth_user_id is null) <> 5 then
    raise exception 'H1 final assertion failed: nullable-auth legacy profile count changed.';
  end if;
end
$final_assertions$;

commit;
