-- Avatar storage setup for the current Firebase Auth + Supabase Storage MVP.
-- The mobile client uploads with the Supabase anon key and does not establish a
-- Supabase-authenticated session, so strict per-user storage enforcement is not
-- possible from the client alone. These policies unblock the single-avatar flow
-- for beta and should be tightened later with a Supabase auth bridge or signed uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read avatars" on storage.objects;
create policy "public can read avatars"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "anon can upload avatars" on storage.objects;
create policy "anon can upload avatars"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'avatars'
  and name like '%/avatar'
);

drop policy if exists "anon can update avatars" on storage.objects;
create policy "anon can update avatars"
on storage.objects
for update
to anon
using (
  bucket_id = 'avatars'
  and name like '%/avatar'
)
with check (
  bucket_id = 'avatars'
  and name like '%/avatar'
);
