# Loop 4.0 Social Foundations QA

## Scope

- Replaced user-facing friendship wording with player-search wording. Internal `FriendSearch` route and component names remain.
- Consolidated Home, Profile History, and Result Confirmation rematch parameters in `challengeNavigation.ts`. The payload retains the canonical opponent profile ID, display name, optional username, sport, sport ID, and rematch flag; Home retains its timing context.
- Carried the opponent username from server-enriched confirmed match data into recent matches. Removed the unused browser-side `getPlayerById` lookup.
- Preserved the existing confirmed-match-derived rivalry record and participant-scoped activity behavior. No friendship, chat, notification, or social-feed feature was added.

## Validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS, including the new navigation helper |
| `git diff --check` | PASS |
| Source-level identity, search, navigation, and social-entry review | PASS |

## Authenticated Expo Web QA

Run in the full app at `http://localhost:8081/` from `/Users/evanlister/rival-loop-04-social-community`, using an existing authenticated session and confirmed match history. No challenge or result was submitted.

| Scenario | Result | Observation |
| --- | --- | --- |
| Find Player | PASS | Username search returned an existing player; selection opened Create Challenge with that opponent locked and Pickleball selected. |
| Home rematch | PASS | An existing rematch opened Create Challenge with the correct opponent, sport, and rematch label. |
| Profile History rematch | PASS | Challenge Again on an existing confirmed match opened Create Challenge with the correct locked opponent and sport. |
| Back and Home navigation | PASS | Back returned to the source screens; Inbox to Home worked; a fresh Create Challenge carried no previous opponent. |
| Post-match Challenge Again | NOT TESTED | No completed-result screen was safely reachable from the existing Home or Profile history without entering a result flow. |
| Full rivalry match count | NOT VERIFIED | Profile displayed an inline opponent record and working Challenge Again action, but the browser view exposed only recent matches and did not independently show the full confirmed history or rivalry match count. |

The two unverified runtime checks are accepted for this checkpoint. They are not runtime passes.

## Observed Nonblocking Issues

- The browser logged repeated avatar image-render errors; initials remained visible. This avatar fallback predates Loop 4.0.
- Expo reported package compatibility notices. No packages were installed or upgraded.
- The Activity notification bell remains inactive. Its treatment is a deferred product decision.

## Repository and Safety

- Worktree: `/Users/evanlister/rival-loop-04-social-community`; branch: `codex/loop-04-social-community`.
- Frozen Loop 3 base: `53fc064d361b565aa793b7929b18379ae4607970` in `/Users/evanlister/rival-loop-03-refresh`.
- No production data mutation, migration, RLS or grant change, Edge Function deployment, package change, progression change, or result-lifecycle change was made for Loop 4.0.

## Follow-up Verification

- Recheck post-match Challenge Again when an existing completed-result screen is safely accessible without creating or confirming a result.
- Verify the full rivalry record and match count against all confirmed matches when a suitable existing read-only history view or approved QA method is available.
