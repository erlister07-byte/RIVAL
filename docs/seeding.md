# Local QA Seed

The project includes a repeatable local QA seed at [local_seed.sql](/Users/evanlister/rival/supabase/seeds/local_seed.sql).

It creates:

- 4 Vancouver mock users
- player sport selections with per-sport skill levels
- 1 pending challenge
- 1 accepted challenge with a submitted result waiting for confirmation
- 1 accepted challenge with a confirmed result

Files:

- SQL seed: [local_seed.sql](/Users/evanlister/rival/supabase/seeds/local_seed.sql)
- Helper script: [seed-local.sh](/Users/evanlister/rival/scripts/seed-local.sh)

Run options:

```bash
npm run seed:local
```

Or directly with a database URL:

```bash
SUPABASE_DB_URL="postgresql://..." npm run seed:local
```

Notes:

- The seed uses stable UUIDs so it can be rerun without accumulating duplicate QA records.
- It resets only the records tied to the QA seed users.
- If you want your logged-in Firebase test account to behave like one of these users, update that profile's `firebase_uid` to your real Firebase UID after signing in once.
