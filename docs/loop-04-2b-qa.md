# Loop 4.2B Authenticated Social API QA

## Scope

- Added authenticated Edge Function APIs for social relationship reads and friendship/block mutations.
- Added a shared social API helper for verified authentication, canonical profile resolution, strict request validation, allowlisted responses, and sanitized errors.
- Added a typed frontend `socialService` for future friendship and blocking UI.
- Added explicit response projections rather than returning raw profile, friendship, or block records.
- No friendship UI, blocking UI, challenge integration, production migration, or deployment was included.

## Authentication model

Every social operation requires a bearer token and verifies it through Supabase Auth `getUser(token)`. The resulting `auth.users.id` is the only source of acting identity. The Edge Function then resolves an onboarded canonical `profiles.id` server-side.

The client supplies only a target profile ID and an operation name. Strict request-key validation rejects actor IDs, auth user IDs, requester identities, blocker identities, and other unsupported fields. The service-role client exists only inside the Edge Function, after authentication, and trusted Loop 4.2A database operations receive the verified auth user ID rather than a client-selected actor.

## API capabilities

`get-social-relationships` supports:

- Relationship lookup with `none`, `outgoing_pending`, `incoming_pending`, and `friends` states
- Accepted-friends list
- Incoming and outgoing active friend-request lists
- Caller-created blocked-player list

`manage-social` supports:

- Send friend request
- Accept or decline an incoming request
- Cancel an outgoing request
- Remove an accepted friendship
- Block another player
- Unblock a player previously blocked by the caller

The typed client service validates target UUIDs, success payloads, public profile projections, timestamps, normalized states, and privacy-safe error codes before returning data to future UI.

## Privacy model

- A blocked relationship returns the same generic `not_found_or_unavailable` response to both parties.
- Relationship lookup never reports whether a block exists or who initiated it.
- The blocked-player list contains only blocks created by the caller because those entries are required for Unblock.
- Reverse blocks are not returned by relationship, friends, requests, or blocked-player list responses.
- Public profile projections contain only canonical profile ID, username, and display name.
- Responses do not expose auth IDs, email, coordinates, challenge radius, raw social rows, block direction columns, service-role information, or internal database errors.
- Unknown database failures are converted to a generic internal error and are not returned verbatim.

## Local authenticated testing

Testing used the disposable local Supabase project on dedicated non-default ports. The test created controlled local Auth users and canonical profiles, obtained real locally issued user JWTs, and invoked the actual local Edge Function HTTP endpoints. Runtime keys were discovered from the local CLI process and were neither stored nor printed by the test.

The final suite completed successfully with **124 assertions passed**. The count increased from the implementation-phase result of 122 after final review added a focused check that a declined relationship is excluded from the caller's active request lists.

Coverage includes:

- Missing and malformed bearer tokens
- Authenticated user with an unavailable/unonboarded profile
- Client actor-spoofing attempt
- Self-request and self-block rejection
- None, outgoing pending, incoming pending, and friends states
- Send, duplicate, reciprocal acceptance, explicit acceptance, decline, cooldown, retry, cancellation, removal, and third-party rejection
- Block creation, duplicate block, accepted-friendship and pending-request termination, blocked requests in both directions, and unblock without restoration
- Reverse-unblock protection and caller-only blocked-player lists
- Friends and incoming/outgoing request lists
- Removed and declined relationships excluded from active lists
- Recursive forbidden-key checks and exact public response projections

## Static validation

| Check | Result |
| --- | --- |
| Local authenticated Edge Function suite | PASS — 124 assertions |
| `npm run typecheck` | PASS |
| `git diff --check` | PASS |
| Trailing-whitespace scan | PASS |

The implementation source did not change during final review. Only the integration suite gained the declined-list assertion, and the complete suite was rerun successfully.

## Production isolation

- Production database modified: **NO**
- Production functions deployed: **NO**
- Production data modified: **NO**
- The Loop 4.2A migration remains unapplied to production.
- All authenticated state-mutating tests used disposable local users and data.

## Intentionally deferred work

- Production migration
- Production Edge Function deployment
- Friendship UI
- Blocking UI
- Challenge and rematch block enforcement
- Find Player search block filtering
- Nearby Player block filtering
- Quick Match and open-challenge block filtering
- Opponent Profile block enforcement
- Pending direct-challenge cancellation integration

Loop 4.1's documented runtime verification gaps remain unresolved. Loop 4.2B local testing does not establish production Opponent Profile response allowlists, authenticated negative-ID behavior, independent rating/record comparison, or uncommon-state coverage.
