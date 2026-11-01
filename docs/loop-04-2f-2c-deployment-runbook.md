# Loop 4 — Public release and recovery gates

Public review edition. Environment-specific audit evidence is retained in the unpublished development history. This document does not certify a deployed environment or authorize release.

This checklist is a design for a future separately authorized release. It contains no environment identity, live inventory, operational recovery snapshot or executable deployment command.

1. Freeze reviewed source, migrations, complete function dependencies and client artifacts. Obtain independent source approval and separate environment authorization.
2. Privately confirm the intended environment and reconcile migration/runtime/client compatibility. Do not infer live state from Git or historical QA.
3. Establish a secure, usable recovery point and rehearse recovery in isolation. Include database state, Storage objects, Auth/configuration, Edge artifacts and clients. Assign ownership, recovery objectives and incident authority.
4. Rehearse the exact migrations in dependency order on a synthetic representative schema; bound lock and statement duration and test ambiguous outcomes.
5. Coordinate enforcement readers and challenge acceptance/creation paths before enabling social mutations. Publish dependent clients only after backend compatibility is established.
6. Verify the approved scoped pause and monitoring procedures. Preserve accepted-match completion and existing block enforcement during interruption or recovery.
7. Run only explicitly approved nonmutating release checks. Fixture creation, load tests and recovery experiments belong in isolated staging.
8. Stop on unexplained drift, failed authorization/privacy checks, missing recovery proof or incompatible artifacts. A successful source merge does not authorize deployment.
9. Prefer compatible forward recovery after social data exists. Unblock does not reverse canceled invitations, removed friendships or prior user actions. Database restoration can lose subsequent writes and requires separate incident approval.
10. Record reviewed artifacts, verification results, residual limitations and accountable signoff privately. Publish only sanitized summaries.

Outstanding requirements remain staging rehearsal, mixed-client compatibility, concurrency/load validation, native/accessibility coverage, recovery proof and operational signoff. No deployment readiness is claimed.
