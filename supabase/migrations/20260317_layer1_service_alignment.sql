do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_firebase_uid_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_firebase_uid_key unique (firebase_uid);
  end if;
end
$$;

create index if not exists profile_sports_sport_id_idx
on public.profile_sports (sport_id);

create index if not exists challenges_status_idx
on public.challenges (status);

create index if not exists matches_challenge_id_idx
on public.matches (challenge_id);
