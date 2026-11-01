# Loop 4 — Deployment review checklist

Public review edition. Environment-specific audit evidence is retained in the unpublished development history. This document does not certify a deployed environment or authorize release.

Status: NO-GO pending independent review and required release verification. Historical operational snapshots and incident-sensitive evidence are intentionally absent from this public edition.

## Candidate scope

Two Loop 4 migrations introduce friendship/blocking foundations and discovery/join eligibility. Review `20260922155601_loop_4_2a_friendship_blocking_foundation.sql` before `20261011000000_social_discovery_and_join_cutoff.sql`. Canonical Loop 3 schema and identity/progression contracts are prerequisites. A fresh baseline and archived migrations must not be replayed on an existing environment.

New source handlers: get-opponent-profile, get-social-relationships and manage-social. Modified handlers: search-profiles, get-nearby-players, get-open-challenges, create-challenge, create-direct-challenge, respond-to-challenge and accept-open-challenge. Source additions do not establish which artifacts are deployed anywhere.

## Required verification

- Reconcile target schema and migration history privately against the exact reviewed artifacts. Never overwrite recorded migrations or repair history merely to force alignment.
- Validate authentication, canonical identity, privilege boundaries, reference data and runtime compatibility without exporting credentials or private records.
- Rehearse a clean install and a representative upgrade using synthetic data in an explicitly approved isolated environment.
- Exercise block/request/accept races, scheduling cutoffs, pagination, large-list behavior, and accepted match/result/XP/rating completion.
- Test both old and new clients against the complete backend. Database, enforcement handlers and social writers must remain compatible throughout rollout.
- Establish a tested scoped pause, compatible artifact restoration, recoverable data and an operator-owned recovery procedure before release.

## Remaining limitations

Historical functional QA does not establish production compatibility, complete accessibility, load capacity or recoverability. Review list limits, request bounds, abuse controls and lock contention. Floating dependency imports require complete reproducible artifact capture. Deployment remains blocked until the release gates are independently signed off.
