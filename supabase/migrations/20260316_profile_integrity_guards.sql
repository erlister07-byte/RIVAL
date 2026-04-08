create unique index if not exists profiles_firebase_uid_unique_idx
on public.profiles (firebase_uid);

comment on index public.profiles_firebase_uid_unique_idx is
'Enforces one app profile per Firebase auth user.';
