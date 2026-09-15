-- Local-development unblocker only.
-- This intentionally allows anon-client access to the Layer 1/2 tables used by the app
-- so development can continue without a Firebase -> Supabase auth bridge.
-- Do not use this policy set in production.

create policy "local dev anon can read sports"
on public.sports
for select
using (true);

create policy "local dev anon can manage profiles"
on public.profiles
for all
using (true)
with check (true);

create policy "local dev anon can manage profile sports"
on public.profile_sports
for all
using (true)
with check (true);

create policy "local dev anon can read profile stats"
on public.profile_stats
for select
using (true);

create policy "local dev anon can manage challenges"
on public.challenges
for all
using (true)
with check (true);

create policy "local dev anon can manage matches"
on public.matches
for all
using (true)
with check (true);

create policy "local dev anon can manage activity events"
on public.activity_events
for all
using (true)
with check (true);
