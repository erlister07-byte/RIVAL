alter table if exists public.sports enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.profile_sports enable row level security;
alter table if exists public.challenges enable row level security;
alter table if exists public.matches enable row level security;
alter table if exists public.profile_stats enable row level security;
alter table if exists public.activity_events enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'activity_events'
  ) and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_events'
      and policyname = 'participants can read related activity events'
  ) then
    create policy "participants can read related activity events"
    on public.activity_events
    for select
    using (
      exists (
        select 1
        from public.profiles p
        where p.firebase_uid = public.requesting_firebase_uid()
          and p.id in (activity_events.actor_profile_id, activity_events.target_profile_id)
      )
    );
  end if;
end
$$;
