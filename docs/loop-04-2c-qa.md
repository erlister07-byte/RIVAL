# Loop 4.2C Backend Block Enforcement QA

## Scope

Backend-only, local implementation. No friendship/blocking UI, production migration, Edge deployment, or push. A local checkpoint commit records the reviewed changes.

## Enforcement architecture

- A shared service-role block helper uses `social_pair_is_blocked` for direct target checks and one bulk `profile_blocks` read for each list request. Both storage directions are treated as mutually effective; responses do not reveal the direction.
- `create-challenge` (the composer and rematch path) and `create-direct-challenge` reject blocked target IDs before insertion. The database trigger is the final concurrent-write guard.
- `respond-to-challenge` direct acceptance and `accept-open-challenge` joining use the service-role-only `social_accept_challenge` function. It resolves the verified actor's canonical profile, takes the same canonical pair lock as blocking **before** locking/updating the challenge row, checks either-direction blocks, and conditionally accepts only a still-pending eligible challenge. Decline and cancel retain their existing paths.
- A targeted challenge trigger covers direct insert, direct acceptance, and open-to-direct join (including alternate service-role writes). It takes the canonical pair lock and checks fresh block state. `social_pair_is_blocked` is `VOLATILE` so a waiter sees a block committed while it waited for the lock.
- `social_block_profile` atomically cancels only pending direct challenges for the pair, both directions, using the existing `canceled` status and `canceled_at` field. Accepted/completed challenges, matches, results, open challenges, ledgers, and statistics are untouched.
- `search-profiles`, `get-nearby-players`, and `get-open-challenges` exclude blocked IDs in their database queries. This is one bulk block lookup per request, not an N+1 query or frontend filter. `get-opponent-profile` returns its existing generic `Profile unavailable` response for blocked and missing targets.

## Local verification

All tests ran against the disposable local Supabase project on dedicated 544xx ports. The pre-existing separate local stack was not modified. The local pgTAP runner needed a temporary, disposable-copy-only `dblink` connection adjustment for password authentication; the checked-in test retains its original connection form.

| Check | Result |
| --- | --- |
| Loop 4.2C authenticated Edge HTTP suite | PASS — 120 assertions |
| Complete Loop 4.2A pgTAP suite, extended for cleanup, guard, grants, and races | PASS — 79 tests |
| Complete Loop 4.2B authenticated social API suite | PASS — 124 assertions |
| Supabase database lint | PASS — no schema errors |
| `npm run typecheck` | PASS |
| `git diff --check` | PASS |

The HTTP suite covers unblocked discovery/profile/direct/open flows; both block directions; known-ID direct, rematch, profile, and open-join bypass attempts; pending direct cancellation; accepted challenge and match preservation; result submission and confirmation after blocking; unrelated players; unblock without restoration; and re-enabled discovery and direct challenges. The pgTAP suite checks challenge-first and block-first creation races, block-first direct acceptance, trigger rejection, and service-role-only acceptance RPC grants.

## Loop 4.1 additional local verification

Verified locally: exact top-level Opponent Profile response keys and record keys; authenticated nonexistent ID (404); self ID (409); blocked ID (same generic 404 from either side); Unrated `skillRating: null`; no-active-sports `sports: []`; and returned W/L/D and Skill Rating compared with local authoritative `profile_stats` and `profile_sport_ratings` after a confirmed fixture match.

Still not verified: the raw **production deployed** response allowlist, production negative-ID behavior, independent production record/rating comparison, and other uncommon production states. These local checks do not close the production-specific gaps in `docs/loop-04-1-qa.md`.

## Migration history

The Loop 4.2A migration `20260922155601_loop_4_2a_friendship_blocking_foundation.sql` was committed earlier but, per the Loop 4.2A and 4.2B QA records, has **not** been applied to production. No repository evidence shows application to a shared backend; this local review did not query remote migration history. Loop 4.2C extends that unreleased migration with pending-direct-challenge cancellation and transactional challenge race protection. Its final content in this checkpoint—not the historical contents of the 4.2A commit—is what must be reviewed before any future deployment. No migration was run against production during this phase.

## Security and isolation

The app's generic `createChallenge` uses `create-challenge`, while the Loop 2 direct flow uses `create-direct-challenge`; both are protected. The browser's legacy direct challenge update cannot bypass acceptance because authenticated clients have no challenge `UPDATE` grant under the canonical security migration. Authenticated profile reads are restricted by `profiles_read_own`; known opponent IDs go through the protected Edge endpoint. `create-open-challenge` remains allowed because it has no counterpart. Historical reads and existing result functions were not changed. Result submission and confirmation after blocking were tested locally; the separate rejection/dispute path was reviewed as unchanged but not re-run in this phase.

Production database modified: **NO**. Production functions deployed: **NO**. Production data modified: **NO**.
