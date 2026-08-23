# Loop 1 QA Results

## Scope

Loop 1 covers authentication, email verification, onboarding, persisted returning-user routing, nearby-player discovery, player selection, and return to discovery.

## Results

- Phase 1: PASS — Welcome, account creation, email verification, and verified incomplete-user onboarding routing.
- Phase 2: PASS — Profile, Pickleball selection, home area, onboarding completion, and sandbox routing to Nearby Players.
- Phase 3: PASS — Completed onboarding persists after reload and routes returning users directly to Nearby Players.
- Phase 4: PASS — Authenticated discovery, empty state, eligible nearby-player display, Loop 1 terminal selection state, and return to discovery.
- Phase 5A: PASS — Browser Network inspection confirmed no challenge, match, or result requests during Nearby Players → Player Selected → Back to Nearby Players. No challenge or match mutation activity was observed.
- Phase 5B: PASS — An authenticated Loop 1 reload made no later-loop requests and opened no Supabase Realtime or application WebSocket activity. The `hot` and `message` socket entries were Expo/Metro development infrastructure.
- Phase 5C: PASS — Availability filtering matched the expected semantics: `now` appears in Ready now, Free today, and This week; `today` appears in Free today and This week; `this_week` appears only in This week. The QA profile was restored to `now`.
- Phase 5D: PASS — With a 10 km discovery radius from Kitsilano, moving the QA profile to legitimate selectable area Burnaby (~13.8 km) correctly excluded it. Restoring Kitsilano correctly made it reappear; the QA baseline is Kitsilano / `now`.

## Resolved Failures

### Returning-user hydration

After reload, a returning user was routed back to onboarding. Firebase-authenticated profile hydration crossed into Supabase through an anonymous client under normal RLS. The owner-only `get-current-profile` Edge Function now verifies the Firebase token and resolves only the caller's profile.

### Nearby-player discovery

Nearby Players incorrectly appeared empty under normal RLS because discovery used direct anonymous profile reads. The authenticated `get-nearby-players` Edge Function now serves Loop 1 discovery only and derives the caller from the verified Firebase token.

## Remaining Limited Verification

- Invalid or unmapped-area candidate exclusion was not tested with a dedicated negative fixture. This state is not reachable through the supported onboarding area choices and does not block Loop 1 stabilization.

## Avatar Observation

- Profiles without an uploaded avatar can generate `net::ERR_BLOCKED_BY_ORB` for the synthesized public avatar request.
- This behavior predates Loop 1. The initials fallback renders successfully, so it is non-blocking and tracked as future avatar cleanup.

## Overall Result

## LOOP 1 — QA COMPLETE / STABILIZED

No BLOCKED or FAIL items remain. Loop 1 is functionally stable for: authentication → verification → onboarding → persisted returning-user routing → authenticated discovery → player-selection terminal state → return to discovery.
