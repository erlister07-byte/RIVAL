drop policy if exists "authenticated users can read pending open challenges" on public.challenges;

create policy "authenticated users can read pending open challenges"
on public.challenges
for select
using (
  auth.role() = 'authenticated'
  and is_open = true
  and status = 'pending'
  and opponent_profile_id is null
);

drop policy if exists "authenticated users can accept pending open challenges" on public.challenges;

create policy "authenticated users can accept pending open challenges"
on public.challenges
for update
using (
  is_open = true
  and status = 'pending'
  and opponent_profile_id is null
  and exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id <> challenges.challenger_profile_id
  )
)
with check (
  is_open = true
  and status = 'accepted'
  and opponent_profile_id is not null
  and exists (
    select 1
    from public.profiles p
    where p.firebase_uid = public.requesting_firebase_uid()
      and p.id = challenges.opponent_profile_id
      and p.id <> challenges.challenger_profile_id
  )
);
