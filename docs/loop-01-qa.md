# Loop 1 QA Results

## Scope

Loop 1 covers authentication, email verification, onboarding, persisted returning-user routing, nearby-player discovery, player selection, and return to discovery.

## Results

- Phase 1: PASS — Welcome, account creation, email verification, and verified incomplete-user onboarding routing.
- Phase 2: PASS — Profile, Pickleball selection, home area, onboarding completion, and sandbox routing to Nearby Players.
- Phase 3: PASS — Completed onboarding persists after reload and routes returning users directly to Nearby Players.
- Phase 4: PASS — Authenticated discovery, empty state, eligible nearby-player display, Loop 1 terminal selection state, and return to discovery.

## Resolved Failures

### Returning-user hydration

After reload, a returning user was routed back to onboarding. Firebase-authenticated profile hydration crossed into Supabase through an anonymous client under normal RLS. The owner-only `get-current-profile` Edge Function now verifies the Firebase token and resolves only the caller's profile.

### Nearby-player discovery

Nearby Players incorrectly appeared empty under normal RLS because discovery used direct anonymous profile reads. The authenticated `get-nearby-players` Edge Function now serves Loop 1 discovery only and derives the caller from the verified Firebase token.

## Remaining Limited Verification

- No independent network-level confirmation that player selection created no challenge mutation.
- No independent capture of unrelated realtime or network traffic.
- Availability filter result changes were not individually exercised for every state.
- Out-of-radius and invalid-candidate exclusion were not tested with dedicated negative fixtures.

## Overall Result

Loop 1 is functionally stable for: authentication → verification → onboarding → persisted returning-user routing → authenticated discovery → player-selection terminal state → return to discovery.
