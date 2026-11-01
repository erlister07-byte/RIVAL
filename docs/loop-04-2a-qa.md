# Loop 4.2A Friendship and Blocking Database Foundation QA

## Implementation scope

- Added a canonical one-row-per-unordered-pair friendship model using `profiles.id` UUIDs.
- Added directional profile blocks with mutually effective interaction enforcement.
- Added trusted-backend database operations for friend requests, responses, cancellation, removal, blocking, unblocking, and block checks.
- Updated the maintained TypeScript database types for the new enum, tables, relationships, and functions.
- No application UI, Edge Function, challenge-flow integration, or production deployment was added in Loop 4.2A.

## Friendship state model

`friend_relationships` stores one canonical row where `profile_a_id < profile_b_id`. Its composite primary key is the final duplicate defense, and a constraint requires `requested_by_profile_id` to be one of the two profiles.

The stored states are `pending`, `accepted`, `declined`, and `removed`. Product-facing `none`, `outgoing_pending`, `incoming_pending`, and `friends` states can be derived from the stored status, requester, and current actor. State-specific constraints enforce required `requested_at`, `responded_at`, `accepted_at`, and `ended_at` combinations.

The trusted operations make duplicate pending requests idempotent, atomically accept reciprocal requests, restrict accept/decline to the recipient, restrict cancellation to the requester, allow either accepted friend to remove the friendship, and enforce a seven-day server-side cooldown after decline. Removed relationships may be requested again.

## Blocking model

`profile_blocks` stores one directional row per `(blocker_profile_id, blocked_profile_id)` pair. The primary key makes duplicate block creation idempotent at the operation layer, a check constraint rejects self-blocks, and a reverse index supports lookups from the blocked side.

Blocking is mutually effective for interaction checks. Creating a block atomically ends an accepted friendship or pending request between the pair. Only the blocker can remove their directional row. Unblocking does not restore a friendship, friend request, or other canceled interaction.

## Privileges and RLS

- RLS is enabled on both social tables.
- `PUBLIC`, `anon`, and `authenticated` have no table privileges.
- The database owner and `service_role` are the only roles with table privileges.
- All social functions revoke execute from `PUBLIC`, `anon`, and `authenticated` and grant execute only to `service_role`.
- All social functions are `SECURITY INVOKER`, use an empty `search_path`, and schema-qualify accessed relations.
- The reusable block check returns only whether either-direction blocking exists; it does not disclose the initiator.

## Trusted-backend operation model

The functions accept a `trusted_actor_auth_user_id`, resolve the canonical actor through `profiles.auth_user_id`, and enforce actor-specific authorization inside the transaction. Ordinary browser roles cannot execute these functions or mutate the underlying tables.

Future authenticated Edge Functions must derive `trusted_actor_auth_user_id` from a verified Supabase session. They must not forward a client-selected acting identity.

## Pair locking and concurrency protection

Every pair mutation computes the same canonical UUID ordering and takes a transaction-scoped advisory lock for that pair. This serializes duplicate and reciprocal requests, request-versus-block, removal-versus-block, and block-versus-unblock operations without a global lock. Transactions remain short, while primary keys and check constraints remain the final integrity defense.

Operation timestamps are captured after the pair lock is acquired. This prevents a waiting operation from recording a response timestamp earlier than the request it observes.

## Isolated local Supabase testing

Testing used a disposable local Supabase project on dedicated non-default ports. Controlled local auth/profile fixtures matched the canonical schema instead of relying on the outdated repository seed. A temporary local-only reference-data bridge allowed the historical migration chain to initialize; it was not added to the repository. The disposable stack was stopped after validation, and the pre-existing local Supabase stack was not modified.

The pgTAP suite completed successfully with **68 tests passed**. Coverage included:

- Schema, constraints, indexes, RLS, grants, and function privileges
- Request creation, duplicate idempotency, reciprocal acceptance, and simultaneous reciprocal requests
- Recipient-only response, requester-only cancellation, either-friend removal, decline cooldown, and retry
- Directional block creation, duplicate behavior, accepted-friendship and pending-request termination, blocker-only unblock, and no restoration
- Requests rejected in both directions while blocked and safe request-versus-block concurrency
- Confirmed match history, rating ledger, XP ledger, match statistics, and XP totals remaining unchanged

Supabase database lint completed with no schema errors.

## Static validation

| Check | Result |
| --- | --- |
| Isolated pgTAP database suite | PASS — 68 tests |
| Supabase database lint | PASS — no schema errors |
| `npm run typecheck` | PASS — using a temporary real `node_modules` copied from frozen Loop 3 after confirming identical lockfiles |
| `git diff --check` | PASS |

The temporary dependency directory was removed after validation. No package manifest, lockfile, or environment file was created or changed.

## Production isolation

- Production database modified: **NO**
- Production functions deployed: **NO**
- Production data modified: **NO**
- The migration has not been applied outside the disposable local test environment.

## Intentionally deferred work

The following are not implemented or verified by Loop 4.2A:

- Authenticated social Edge Functions
- Friendship UI
- Blocking UI
- Challenge and rematch block enforcement
- Find Player, Nearby Player, and Quick Match block filtering
- Opponent Profile block filtering
- Pending direct-challenge cancellation integration
- Production migration or deployment

Loop 4.1's documented runtime verification gaps remain unresolved: the deployed response allowlist, authenticated negative-ID responses, independent record/rating database comparison, and uncommon Opponent Profile states must not be described as verified.
