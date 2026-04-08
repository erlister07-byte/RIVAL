# RIVAL Layer 1 Schema

## Design goals

- Support multi-sport players with independent skill levels.
- Keep challenge creation and result confirmation simple for the MVP.
- Separate `challenges` from `matches` so confirmed results, disputes, activity feed events, achievements, and rivalry rollups can evolve without overloading one table.
- Preserve stable UUID identifiers so future modules can attach to profiles, challenges, and matches without rewriting existing records.

## Table summary

- `profiles`: user identity and Vancouver onboarding data.
- `sports`: seeded list of supported sports.
- `profile_sports`: join table for many-to-many user sport participation and skill per sport.
- `challenges`: invitation and lifecycle record between two users.
- `matches`: result lifecycle record linked 1:1 with an accepted challenge.
- `profile_stats`: denormalized stats updated when a result is confirmed.

## Why this shape is safe for later expansion

- Team sports can be added later by introducing `teams`, `team_members`, and optional `challenge_sides` or `match_sides` tables while keeping current `profiles`, `challenges`, and `matches` ids intact.
- Rivalries can be added as a derived table keyed by two profile ids and populated from confirmed matches.
- Activity feed can be added with an append-only `activity_events` table keyed to `profile_id`, `challenge_id`, and `match_id`.
- Achievements can be added as `achievement_definitions` and `profile_achievements`, triggered off confirmed matches and stats.

## RLS recommendations

- If Firebase remains the identity provider, mint Supabase JWTs with a `firebase_uid` claim and use that claim in policies.
- Keep `sports` globally readable to authenticated users.
- Allow broad profile discovery reads for authenticated users, but restrict writes to the owner profile.
- Restrict challenge and match reads to participants only.
- Restrict challenge inserts to the challenger.
- Restrict match result submission and confirmation to match participants only.
- Keep `profile_stats` readable by the owner at minimum. If public profiles are desired, loosen that policy later.
- Do not rely only on RLS for lifecycle correctness. Keep status transitions guarded in application logic and add database checks or RPC functions as the app matures.
