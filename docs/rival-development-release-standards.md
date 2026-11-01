# RIVAL development and release standards

Public review edition. Environment-specific audit evidence is retained in the unpublished development history. This document does not certify a deployed environment or authorize release.

## Development and review

- Define functional ownership, identity, authorization, state transitions, events and dependencies before editing.
- Use scoped branches and preserve existing worktrees, documents and uncommitted work.
- Keep server-side authorization and database invariants authoritative. Review outsider/self/blocked/stale and concurrent cases.
- Keep credentials, private records and operational evidence out of public Git history. Publish synthetic fixtures and sanitized summaries only.
- Record exact source scope and meaningful tests. Separate historical evidence, fresh passes, failures and unverified behavior.
- Review migrations, privileges, complete function artifacts and client contracts together. Capture dependency provenance.

## Source merge gate

Require independent review, relevant checks, dependency order and explicit approval. Verify automation so a source merge cannot silently deploy. Source approval is distinct from database, backend and client release authorization.

## Staging gate

Explicitly approve the isolated destination and synthetic fixtures. Rehearse clean installation and representative upgrades, old/new clients, authorization, races, list/load limits, native usability and recovery. Do not infer staging authorization from another environment's existence.

## Release gate

Privately verify the exact environment, current schema/history/runtime, reviewed artifacts and client distribution. Establish secure recovery material, tested restoration, recovery objectives and operator ownership. Verify a scoped pause, monitoring, stop/go criteria and compatible recovery. Require separate explicit database, Edge and client approvals. Never replay baselines/archives/seeds on an existing environment or use history repair to force compatibility.

## After release

Perform only approved checks, retain reproducible artifacts, record residual limitations and verify recovery custody. Preserve block/history and canonical result integrity during incident handling. Destructive recovery needs separate authorization.

## Evidence format

Each gate records source/artifacts, scope, environment authorization, tests and outcomes, limitations, owner/date and approval. Public summaries exclude private environment identifiers, live operational inventories and sensitive security/recovery evidence. No current release signoff is implied by this checklist.
