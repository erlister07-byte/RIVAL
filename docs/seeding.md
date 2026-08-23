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
- To associate a seeded profile with a Supabase Auth test account, give the profile the same email address. The onboarding profile upsert will claim that row for the authenticated account.
