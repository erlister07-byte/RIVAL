# Loop 2 QA Results

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

## Phase 2 Scope

Phase 2 adds direct-challenge responses only: Incoming Accept, Incoming Decline, and Outgoing Cancel. It does not add result submission, result confirmation, disputes, Open Challenge, or progression behavior.

## Phase 2 Security Boundary

Firebase ID tokens are verified internally and the caller profile is derived server-side. The client sends only challengeId and one supported action: accept, decline, or cancel. Accept and Decline require the recipient; Cancel requires the sender. Direct challenges only are accepted. The conditional update includes the authorized role and pending guard; malformed payloads return 400, wrong role 403, missing challenges 404, and terminal/race updates 409. The client provides no profile ID, Firebase UID, participant role, resulting status, or match ID.

## Phase 2 Accept QA

- **PASS:** Keither received Ryan's incoming Pending challenge with Accept and Decline visible and Cancel absent.
- **PASS:** One Accept action produced the Challenge Accepted terminal state naming Ryan and stating that a match was created; result handling was not exposed.
- **STATIC PASS:** the accepted transition relies on the existing accepted-challenge trigger; the trigger-owned insert uses the unique challenge link and conflict guard, with initial pending_submission status.
- **INHERITED ACTIVITY:** the existing trigger may create one challenge_accepted event. Neither the client nor response function creates activity manually.
- **LIMITED:** exact challenge, match, and activity-event rows were not inspected directly.

## Phase 2 Decline QA

- **PASS:** Keither received Ryan's incoming Pending challenge with Accept and Decline visible and Cancel absent.
- **PASS:** One Decline action produced the Challenge Declined terminal state naming Ryan and stating that the challenge was no longer pending.
- **STATIC PASS:** Decline changes pending to declined without a match, result, or progression path.
- **PASS:** no challenge_declined activity event exists in the current activity schema or triggers.
- **LIMITED:** the exact declined challenge row was not inspected directly.

## Phase 2 Cancel QA

- **PASS:** Ryan saw an outgoing Pending challenge to Keither with Cancel Challenge visible and Accept/Decline absent.
- **PASS:** One Cancel action produced the Challenge Canceled terminal state naming Keither and stating that the challenge was no longer pending.
- **STATIC PASS:** the canonical database status is canceled; the sender-only transition sets canceled_at and cannot create a match, result, or progression path.
- **PASS:** no challenge_canceled activity event exists in the current activity schema or triggers.
- **LIMITED:** the exact canceled challenge row was not inspected directly.

## Match Trigger Regression

- **PASS:** respond-to-challenge never inserts a match; it reads a match only after acceptance.
- **PASS:** the existing accepted-challenge trigger remains the sole match-creation path and is guarded by accepted status.
- **PASS:** Decline and Cancel cannot satisfy that accepted-only trigger. Result submission remains outside Loop 2 Phase 2.

## QA Session Diagnostic

- An apparent discovery discrepancy was caused by the QA browser being authenticated as Keither while it was believed to be Ryan.
- Self-exclusion was correct; Ryan and Keither have distinct Firebase identity mappings.
- Temporary discovery diagnostics were removed. get-nearby-players was restored exactly to Loop 1 baseline c9a9b65a and redeployed.
- No product discovery fix was required.

## Phase 2 Limitations

- Direct row-level verification remains limited for exact challenge, match, result, and activity-event counts.
- Concurrency protection is validated primarily by the atomic conditional update and schema/trigger reasoning; it was not independently runtime-raced.
- No claim is made for unrun result lifecycle, Open Challenge, or progression tests.

## Loop 1 Regression

**PASS (prior manual regression):** In the separate Loop 1 sandbox, Nearby Players and the selected-player terminal state remained available, while Challenge Player and Pending Challenges were absent. The final Phase 2 source review confirms those Loop 1-only conditions remain unchanged; no dedicated Loop 1 Expo process was available for a new runtime pass.

## Deferred to Phase 3+

- Match lifecycle
- Result submission, confirmation, and disputes
- Open Challenge and Quick Match
- XP, ratings/ELO, badges, streaks, leaderboards, rivalries, and rematches

## Overall Status

Loop 2 Phases 1 and 2 are functionally verified through persisted sender Pending state and direct-challenge Accept, Decline, and Cancel terminal paths. Direct database-row inspection, authenticated negative-response captures, database-level downstream-table inspection, server-concurrency race behavior, and runtime Network/realtime capture remain explicitly limited.
