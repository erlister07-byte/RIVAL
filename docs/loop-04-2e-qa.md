# Loop 4.2E — Blocking UI local QA

## Scope and architecture

This is a UI-only local checkpoint phase. Opponent Profile adds a secondary Block Player control beneath friendship actions. Block and Unblock use the existing authenticated `socialService` methods; the client sends only the target profile ID and action, never an acting user ID. The existing backend remains authoritative for two-way interaction restrictions, friendship/request termination, pending direct-challenge cancellation, and accepted-match preservation.

Block uses the existing web `window.confirm` / native `Alert.alert` convention. Its copy distinguishes restricted future interaction and canceled pending direct challenges from preserved accepted matches and history. The mutation is locked against duplicate submission, shows pending state, and does not optimistically claim success. On success, Opponent Profile clears the profile and friendship state and shows its existing generic unavailable screen, leaving no actionable Challenge/Rematch control. An unavailable target also resolves generically; other failures retain the profile with a privacy-safe error and a usable Block retry.

Owner Profile has a discreet Blocked Players entry beside Friends. The typed stack screen loads `getBlockedPlayers()` on focus, shows only caller-created blocks with the API's public identity and initials fallback, and has no navigation from a blocked row to Opponent Profile. Its loading, ready, empty, and error states are distinct. A loaded-user ID guard prevents rows from a prior authenticated session appearing during a session change. Unblock requires confirmation; its copy does not promise discovery or restore any prior relationship. A failed mutation retains the row and shows a generic error; success triggers one account-scoped authoritative list refresh, which removes the row when the refreshed response arrives.

A small in-memory UI invalidation signal refreshes the existing Inbox attention counts after a successful Block or Unblock. It adds no polling, durable unread storage, block Activity event, or notification channel. Friends and friend-request lists continue to refresh on focus. Existing direct Challenge/Rematch, result, history, and Quick Match code paths were not rewritten.

## Isolated environment

The established disposable Supabase project at `/private/tmp/rival-loop42a.UOslir` ran on dedicated 544xx ports with the local Loop 4.2A–C database and functions. Expo web ran on port 19006 using process-only URL and local anon key; no `.env` file was created or modified. Three new controlled local Auth/profile users (A/B/C) and local friendship/challenge fixtures were used. No production endpoint, account, database, or function was used.

## Previously recorded authenticated Expo web QA

| Flow | Status | Evidence / boundary |
| --- | --- | --- |
| Opponent Profile Block control | VERIFIED LOCALLY | A opened B from Find Player; Challenge remained above Friendship and the secondary Block Player action. Block confirmation named B and described future restrictions, pending direct-challenge cancellation, and accepted/history preservation. Cancel left B available. Confirm changed the screen to generic “This profile is unavailable” with no actionable Challenge or friendship controls. A stale Find Player row also opened only that generic state. |
| Pending friend request termination | VERIFIED LOCALLY | A sent B a request in the app, then blocked B in the app. After B signed in, Home had no friend-request badge and Inbox showed Incoming (0) and Sent (0). A later unblocked B; B was discoverable again and A's Opponent Profile showed Add Friend, not a restored request. |
| Blocked Players and Unblock | VERIFIED LOCALLY | A's private list showed the caller-created B block with correct display name and username, with no profile-opening row action. Cancel Unblock retained B. Confirm removed B; the “No blocked players” empty state appeared. Find Player then found B again. |
| Accepted friendship termination | VERIFIED LOCALLY | A/C were accepted friends before A used the app's Block control on C. C's profile became unavailable, and A's Friends screen refreshed to “No friends yet.” No stale re-request control remained on Opponent Profile. |
| Pending direct challenge cancellation | VERIFIED LOCALLY | A/C had a pending direct challenge before the app Block. A read-only local backend check showed it `canceled` with `canceled_at`. The accepted challenge was not canceled. |
| Accepted match, results, and history | VERIFIED LOCALLY | A/C had an accepted match before the app Block. A's Match Results still offered submission; A submitted an 11–7 win, C signed in and confirmed it, and the match completed. Both users' Profile History retained opponent identity, score, W/L/D, and rivalry record; C received progression XP. Historical View Profile showed the generic unavailable state. |
| Blocked rematch | VERIFIED LOCALLY | C's Challenge Again opened the existing locked A/pickleball composer after block. Send failed generically with “Opponent profile not found”; no success was shown. |
| Caller-only list and reverse block | VERIFIED LOCALLY | With A blocking C, C's Blocked Players list was empty. A local authenticated API fixture then added C's own reverse block. A's own Unblock removed A's row (confirmed by local API and a fresh app list), while A's historical View Profile for C remained generically unavailable. The browser automation stalled during that second confirmation, so the immediate in-place list transition was not observed; the mutation and refreshed app state were. |
| Inbox badge invalidation | VERIFIED LOCALLY / REVIEWED IN CODE | B's post-block Home had no incoming-request badge, and Inbox had no request rows. The new same-session event hook in BottomTabBar was reviewed in code; a live cross-screen badge transition during the exact Block moment was not separately captured. |
| Find Player, Friends, owner Profile, Inbox, Challenge/Rematch | VERIFIED LOCALLY | These paths were exercised with A/B/C as described above; existing navigation and challenge behavior remained usable. |
| Nearby and blocked Quick Match Join | REVIEWED IN CODE | Loop 4.2E changed neither backend enforcement nor these screens. The prior Loop 4.2D local QA and Loop 4.2C authenticated suite covered them; they were not independently re-exercised in this phase's app session. |
| Block/Unblock network failure, stale profile, concurrent device changes | REVIEWED IN CODE | Mutations retain safe errors or switch to generic unavailable, lists refresh on focus, and the backend remains authoritative. These unusual failures were not manufactured in the app. |
| Native iOS/Android and accessibility QA | DEFERRED | Expo web was used for this local phase; device/simulator and screen-reader behavior still need the final Loop 4 regression gate. |
| Production runtime and full Loop 4 regression | DEFERRED | No production deployment or broad final regression was authorized in this phase. |

## Previously recorded automated and static validation

- `npm run typecheck`: PASS.
- `git diff --check`: PASS.
- Existing Loop 4.2C authenticated block-enforcement suite: PASS, 120 assertions, against the disposable local project.
- Backend source, migration, and Edge Functions were not changed, so database suites were not rerun solely for repetition.
- A temporary real `node_modules` copy from frozen Loop 3 was used after identical lockfile hashes were verified; no `node_modules` symlink was made.

## Privacy and limitations

The UI never displays who initiated a generic blocked interaction. Only caller-created blocks are shown in Blocked Players so that the caller can Unblock them. Public list rows use only display name and username from the existing API; no avatar backend expansion, raw block columns, email, auth ID, or reverse-block status is surfaced. Unblocking does not recreate friendships, requests, or canceled challenges, and a reverse block still prevents access.

The in-memory attention refresh is not a durable cross-device unread system. Other-device changes require existing navigation/foreground refresh points. The browser automation stalled during one repeated web confirmation; local API and a fresh app tab established the resulting reverse-block state, but that single immediate transition is not claimed as visually verified. No reporting, moderation, chat, feed, push, new top-level tab, or production change was added.

## Final review session — 2026-09-22

### Repository preflight and complete diff review

Loop 4 was on `codex/loop-04-social-community` at `956f46f8508b6cab6724f1726fbac8487fba43e1`, with an empty index and exactly the eight intended UI/documentation files modified or untracked. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. No branch/worktree was created and no existing changes were discarded.

The complete phase diff was reviewed, including navigation, owner Profile entry, Opponent Profile, Blocked Players, the in-memory refresh signal, and BottomTabBar subscription/cleanup. Existing authenticated service and backend code were read without changes: the blocked query filters by the authenticated caller as blocker; Unblock deletes only that caller's directional block. Block terminates pending/accepted friendships and pending direct challenges; Unblock restores none of them. Accepted matches, result paths, history, XP, ratings, and rivalry data are outside this UI diff. Earlier authenticated QA supplies the runtime evidence for those preserved behaviors; those backend tests were not rerun this session.

Friends and friend-request lists retain focus refresh; the successful-mutation signal refreshes Inbox attention counts without polling or adding notifications. Rows expose public identity only and have no opponent-navigation action. Block remains secondary, requires confirmation, locks duplicate submissions, and replaces all opponent actions with a generic unavailable view only after success (or a generic unavailable response). Failed mutations do not claim success.

### Interrupted edit and additional correction

Retained the interrupted replacement of an inline post-Unblock fetch with the existing focus loader via `reload`. The loader's cleanup discards obsolete fetch completions, and its loaded-user guard hides the preceding account's rows. This preserves one immediate refresh after successful Unblock without a second independent list request.

The edit alone did not guard delayed native confirmation callbacks or mutation success/error/finally handlers. Added a small account/focus lifetime guard, invalidated in layout cleanup on account change, blur, or unmount. Old confirmations cannot start a mutation after that lifetime ends; old completions cannot refresh another account, surface stale errors, or clear its busy state. New lifetimes reset pending UI state. Applied the same guard to the newly added Opponent Profile Block action, scoped additionally to target identity, and prevented friendship mutation dispatch while Block is pending. No service, backend, migration, or unrelated search code changed.

These guards cover committed UI account/focus transitions. They do not cancel an already dispatched backend mutation. Existing AppProvider hydration/AuthGate removes the authenticated navigator during an account change. Simultaneous-device and unusual transport/auth interleavings remain part of deferred broader QA.

### New validation actually run

- `npm run typecheck`: PASS after the corrections.
- `git diff --check`: PASS after the corrections.
- Focused local React 19.1 component harness: **14 scenarios PASS**. It transpiled the actual screen sources and rendered them with controlled deferred service promises. It used mocked services/native primitives; no network or Supabase requests were made.
- Scenarios: confirmed Unblock refreshes exactly once and preserves other rows; Cancel does not mutate; duplicate confirmation during an active mutation is ignored; failed Unblock retains its row with a safe error; refresh failure offers Retry and successful retry shows empty state; old list response cannot overwrite the new account; old confirmation cannot mutate for the new account; old mutation success cannot refresh the new account or clear its busy state; old error cannot appear on the new account; post-Unblock fetch cannot overwrite the new account; blur/refocus invalidates old confirmation; unmount ignores old completion/confirmation; successful Block removes actionable controls; old Block confirmation cannot mutate after account switch; old Block completion cannot hide the new account's profile. Some assertions are grouped within the 14 scenarios.
- Harness command: `node /private/tmp/rival42e-component-qa/test.cjs`. Temporary React test dependencies were installed only under `/private/tmp`; they are not project dependency changes. The renderer emitted its deprecation notice but no failing assertions.
- Matching lockfile SHA-1 `14b6955dac6ec60c3e0db1b0c1455adfa1c9a47c` was verified before a temporary real dependency copy from frozen Loop 3 was used for TypeScript. Frozen Loop 3 was only read.

### Evidence boundaries and deferred QA

No fresh authenticated browser/native UI session was run in this final review. The deterministic component tests establish the changed async ordering and rendered component states, but are not visual or authenticated end-to-end QA. The earlier browser-automation stall still means that one immediate reverse-block Unblock transition was not visually observed; its previously recorded local API/fresh-tab evidence remains unchanged. This session does not retroactively turn that stalled test into a pass.

Native iOS/Android, screen readers, unusual network/simultaneous-device behavior, a fresh visual check of the changed transition, and full Loop 4 regression remain deferred to 4.2F. The username underscore-stripping discovery defect remains separate.

Docker inventory confirmed no running containers for the dedicated `rival-loop42a.UOslir` QA stack; it was not restarted. A different baseline-validation stack was left untouched. No production endpoint or account was used; no environment file, production data, migration, or function was modified or deployed. No push, merge, or 4.2F work was performed.

Final pre-stage validation: `npm run typecheck` and `git diff --check` both PASS. The temporary Loop 4 `node_modules` copy and temporary component-harness dependencies were removed after validation. No dependency manifests or lockfiles changed.
