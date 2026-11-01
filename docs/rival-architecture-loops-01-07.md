# RIVAL architecture — Loops 1–7

Public review edition. Environment-specific audit evidence is retained in the unpublished development history. This document does not certify a deployed environment or authorize release.

## Implemented ownership

| Area | Owner and contract |
| --- | --- |
| Account and onboarding | Supabase Auth sessions map to canonical profiles; client navigation reflects authenticated onboarding state. |
| Discovery | Server-authorized projections provide eligible player/challenge views. |
| Competitive lifecycle | Challenges lead to matches and confirmed results; canonical database transitions own lifecycle changes. |
| Progression | Loop 3 derives records, ratings, XP, levels and streaks from canonical results. |
| Social | Loop 4 owns friendship/request/block transitions and public opponent projections. Blocking preserves accepted results/history. |

Keep privileged mutations server-authorized, projections deliberate and database privileges least-privileged. UI visibility is not authorization. Resolve caller identity from authenticated state; never trust a client-selected actor. Pair concurrency and result idempotency are cross-loop invariants.

Current activity events represent challenge creation, challenge acceptance and match completion and are participant-scoped. They are not a friends feed. Future delivery systems must consume canonical events without creating duplicate progression or competitive state transitions.

## Future contracts — proposals only

Loop 5 retention/engagement should consume canonical outcomes with deduplication, user preferences, lifecycle/expiry and privacy controls. Loop 6 private messaging requires explicit participant authorization, blocking policy, retention and abuse handling. Loop 7 friends activity requires an explicit audience/consent model, event visibility, media policy and revocation behavior. These proposals do not implement or authorize those loops.

## Evolution and integration

Use additive, reviewed migrations and explicit compatibility contracts. Never rewrite applied migrations or replay archives on an existing environment. Keep result/progression authority separate from social and future engagement features. Review each new consumer's actor, audience, state transition, retry/idempotency and retention rules.

Use scoped branches and PRs; preserve worktrees and uncommitted changes. Verify required checks and external automation rather than assuming a merge cannot deploy. Review Loop 3 before Loop 4; future loops require separate review.

## Known limitations and release gates

Require isolated synthetic-data integration, race/load tests, old/new client compatibility, native/accessibility coverage, reproducible artifacts and tested recovery. Review list pagination, resource bounds, abuse controls, legacy identities and event privacy before broader reuse. Complete a scoped pause and operator signoff before release. No environment's readiness, backup capability or deployment configuration is certified here.
