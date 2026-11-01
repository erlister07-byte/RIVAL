# Loops 1–4 — Integration readiness

Public review edition. Environment-specific audit evidence is retained in the unpublished development history. This document does not certify a deployed environment or authorize release.

## Functional dependencies

Loop 1 owns account/onboarding/discovery foundations. Loop 2 owns challenges, matches and result lifecycle. Loop 3 owns progression and rewards derived from canonical confirmed results. Loop 4 adds opponent profiles, friendships, requests and blocking while preserving those underlying lifecycles.

Social state must not independently award XP, change ratings or duplicate confirmed-result processing. Blocking preserves accepted-match history and completion while restricting discovery and new interactions. Canonical profile identity must remain consistent through search, profile, challenge, rematch and Inbox navigation.

## Review order

Loop 3 targets main. The reconstructed Loop 4 review branch starts at exact Loop 3 commit `53fc064d361b565aa793b7929b18379ae4607970` and initially targets that branch. Review Loop 3 first; after its approved merge, retarget Loop 4 and recheck the final comparison. No Loop 5 implementation belongs in these PRs.

## Required isolated staging coverage

- Sign-in, session refresh, onboarding, availability, discovery and account switching.
- Direct/open challenge create, respond, cancel and join, including stale state, scheduling cutoff and concurrent acceptance.
- Win/draw/dispute confirmation, canonical record updates, ratings, XP, levels and streaks without duplicate awards.
- Opponent profiles, rematches, friendship transitions, Inbox badges, block/unblock and accepted-result completion after blocking.
- Old/new client contracts, unavailable data, retries, permission denials and legacy identity fixtures.
- Large lists, pagination, dense block graphs, concurrent transitions, latency and bounded resource use.
- Native devices, second-device state refresh, accessibility and recovery rehearsal.

## Evidence and limitations

Historical Loop 1/2 QA predates parts of the current Auth architecture. Loop 3 implementation is recorded in Git; no dedicated tracked Loop 3 end-to-end QA report was found. Loop 4 includes durable SQL/API tests and historical manual/component QA. Temporary harnesses are not complete CI coverage. Auto-confirm scheduling, cross-session freshness, integrated scale, full accessibility and recoverability require release validation.

The publication inspection passed TypeScript and whitespace checks; the challenge-error suite passed. Docker/network restrictions prevented four integration suites from initializing. These failures are environmental blockers, not passing tests.

## Release requirements

Independently approve source, rehearse migrations and complete artifacts in explicitly approved staging with synthetic data, validate runtime compatibility, establish tested recovery and scoped pause, and obtain separate database/backend/client release approvals. Verify external automation before any merge. Do not replay fresh baselines or migration archives on existing environments. Release remains NO-GO until required evidence and signoffs are complete.
