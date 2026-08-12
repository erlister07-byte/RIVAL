# Loop 2 Phase 1 QA Results

## Scope

Phase 1 covers:

Nearby Players → Player Selected → Create Direct Challenge → Pending Challenge → reload → persisted Pending.

It does not include challenge responses, cancellation, match lifecycle, results, disputes, Open Challenge, or progression systems.

## Branch and Runtime Modes

- Branch: `codex/loop-02-challenge-match`
- Base: stabilized Loop 1 commit `8106dcc7`
- `loop-01` remains an explicit player-selection-only sandbox.
- `loop-02` is an explicit direct-challenge sandbox.
- Omitting the startup mode, or using `full-app`, retains the normal full-app default.

## Authentication Architecture

Firebase Auth → Firebase ID token → authenticated Edge Function → internal Firebase token verification → server-derived RIVAL profile → service-role Supabase operation.

The client does not provide the challenger profile, Firebase UID, creator identity, or initial challenge status.

## Edge Functions

- `create-direct-challenge`
- `get-user-challenges`

Both functions were deployed to `rgquxhkburgpzghwslbd` with `verify_jwt = false`; each verifies Firebase ID tokens internally. No migration, RLS weakening, or anonymous-RLS bypass was used.

## Happy-Path QA

- **Authentication and hydration — PASS:** an authenticated, onboarding-complete user bypassed Welcome, verification, and onboarding; Nearby Players loaded and displayed the eligible QA player.
- **Player selection — PASS:** the selected-player state showed basic identity, Pickleball, skill level, area, distance, Back to Nearby Players, and the Loop 2-only Challenge Player action.
- **Create Challenge navigation — PASS:** Challenge Player opened a direct Challenge screen with the intended locked opponent, Pickleball, Singles, timing, Kits Beach Courts, Bragging Rights, and Send Challenge.
- **Direct challenge creation — PASS:** Send Challenge was used once, completed without a visible error, and navigated to Pending Challenges.
- **Sender pending state — PASS:** the pending card showed the intended opponent, Pickleball / Bragging Rights, and the configured location and time.
- **Persistence after reload — PASS:** after reload, Pending Challenges displayed the original challenge as Pending. No additional challenge was created.

## Security QA

- **Missing Firebase token — PASS:** both Phase 1 functions returned `401`; no mutation path was reached.
- **Malformed Firebase token — PASS:** both Phase 1 functions returned `401`; no mutation path was reached.
- **Spoofed retrieval at the authentication boundary — PASS:** a spoofed profile field with malformed authentication returned `401` and could not bypass authentication.
- **Server-side input hardening — STATIC PASS:** `create-direct-challenge` rejects unsupported fields, derives the caller only from verified Firebase claims, assigns `pending` server-side, rejects self-challenge, checks both profiles' active Pickleball eligibility, and validates supported configuration values.
- **Authenticated negative cases — LIMITED:** self-challenge, nonexistent-opponent, valid-token caller/status spoofing, and invalid-payload responses were not issued because that would require handling an authenticated Firebase token outside the normal QA flow. The static safeguards are present but those response paths were not runtime-captured.

## Database and Downstream Isolation

- **Challenge row details — LIMITED:** persisted pending state, opponent, configuration, and timing were confirmed through the sender's post-reload Pending Challenges view. Direct row-level database inspection was not available without accessing credentials or a signed-in dashboard session.
- **Match absence — SCHEMA/TRIGGER AUDIT PASS:** the `create_match_on_accepted_challenge` trigger runs only on a challenge update to `accepted`; a `pending` insert does not create a match.
- **Result absence — STATIC PASS:** no Phase 1 screen, provider effect, or Edge Function calls result creation or result mutation.
- **Inherited activity event — ACCEPTED:** the pre-existing `activity_event_on_challenge_insert` trigger may create one `challenge_created` activity row for a new challenge. This is a transactionally coupled database side effect that predates Loop 2; it is not exposed as a Phase 1 product feature.
- **Downstream progression — STATIC PASS:** Phase 1 does not invoke XP, rating/ELO, badge, streak, leaderboard, rivalry, rematch, match, or result behavior. Direct database verification of those tables was not available.

## Duplicate Protection

- **Immediate UI protection — PASS:** Create Challenge has an in-flight submission guard and disables the action while sending; manual QA submitted once.
- **Server concurrency semantics — NOT DESTRUCTIVELY TESTED:** no second valid pending challenge was created to test duplicate/race behavior. No claim of database-level race protection is made.

## Runtime Isolation

- **Static isolation — PASS:** Loop 2 mounts only Nearby Players, Create Challenge, and the limited pending inbox. It does not mount Tabs/Home, Activity, Results, the full challenge inbox, or its realtime subscription.
- **Provider isolation — PASS:** Loop 2 suppresses home refresh, profile secondary stats/recent matches, challenge provider loading, match provider loading, and provider nearby-player prefetch.
- **Runtime network capture — LIMITED:** no independent browser Network capture was recorded for unrelated requests or realtime subscriptions. Static isolation does not substitute for that capture.

## Friend Search

Friend Search remains a full-app secondary path and is not reachable from the Loop 2 navigator. It was not secured or connected in this phase to avoid broadening the canonical Nearby Players flow; it is deferred and does not block Phase 1.

## Loop 1 Regression

**PASS:** In the separate Loop 1 sandbox, Nearby Players and the selected-player terminal state remained available, while Challenge Player and Pending Challenges were absent.

## Deferred to Phase 2+

- Accept, Decline, and Cancel
- Match lifecycle
- Result submission, confirmation, and disputes
- Open Challenge and Quick Match
- XP, ratings/ELO, badges, streaks, leaderboards, rivalries, and rematches

## Overall Status

The canonical Loop 2 Phase 1 flow is functionally verified through persisted sender Pending state. Direct database-row inspection, authenticated negative-response captures, database-level downstream-table inspection, server-concurrency duplicate behavior, and runtime Network/realtime capture remain explicitly limited.
