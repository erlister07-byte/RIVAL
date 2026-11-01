# Loop 4.2F-1 — Final local social integration and regression QA

> Current outcome (2026-10-10): **LOOP 4.2F-1 COMPLETE — LOCAL FUNCTIONAL QA PASSED**. Founder manual verification passed all five Nearby Players checks on the prepared native simulator, resolving the P2 scrolling defect locally. Earlier automated gesture limitations remain historical; they are not relabeled as automated passes. VoiceOver and second-device coverage remain deferred release QA.

## Repository Preflight

Preflight on 2026-09-23 verified `/Users/evanlister/rival-loop-04-social-community`, branch `codex/loop-04-social-community`, HEAD `5ee23635022e25c905a2be64f2f5d2638a80e5a2`, clean worktree and empty index. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. Reviewed the QA documents for 4.0, 4.1, and 4.2A–E. The initial consolidated matrix was written before testing; the table below records final results from this QA run across its usage interruptions (2026-09-23–24).

Prior gaps included post-result rematch/rivalry history (4.0), profile negative/data cases and production checks (4.1), dispute/reject (4.2C), reciprocal UI outcome/network/native/accessibility/underscore search (4.2D), and immediate Unblock, live Block badge refresh and lifecycle guards (4.2E). Historical passes are not counted as new results here. Production verification remains outside scope.

## Consolidated QA Matrix

VERIFIED LOCALLY identifies the actual evidence surface: authenticated web UI, authenticated local API/database, or mocked component tests. These are not interchangeable. DEFERRED means the specified surface remains unverified; FAILED identifies a reproduced unresolved defect.

| Item | Classification | Current evidence / boundary |
| --- | --- | --- |
| Find → profile → send → incoming → accept | VERIFIED LOCALLY | Authenticated A/B web flow. |
| Both users Friends and Friends lists | VERIFIED LOCALLY | B/D web state and lists after reciprocal API acceptance. |
| Remove Friend | VERIFIED LOCALLY | Web removal observed; API lifecycle coverage. Both-side post-removal visual and Cancel remain deferred. |
| Outgoing cancellation | VERIFIED LOCALLY | Opponent Profile web action, plus API. Inbox Cancel remains deferred. |
| Decline / seven-day cooldown | VERIFIED LOCALLY | Social API; current web cooldown/Retry interaction deferred. |
| Reciprocal acceptance / duplicate prevention | VERIFIED LOCALLY | Authenticated API plus resulting B/D UI; duplicate component tests. |
| Blocks end friendship, requests, pending challenges | VERIFIED LOCALLY | Database/API suites; web Block led to unavailable profile. |
| Caller-only list/unblock and reverse block retained | VERIFIED LOCALLY | Database/API and authenticated owner list. |
| Same-screen Unblock removes row, retains other row, then empty | VERIFIED LOCALLY | Authenticated B web session; no new tab/restart between transitions. |
| Unblock Cancel and reliable Confirm-control interaction | DEFERRED | Dialog controls inaccessible to browser tooling; component cancellation passes only. |
| Delayed responses, account/focus/unmount safety | VERIFIED LOCALLY | Focused component tests; ordinary authenticated account switching also exercised. |
| Inbox incoming/outgoing, identity navigation, accept | VERIFIED LOCALLY | Web UI. Incoming attention 1; outgoing did not add attention. |
| Existing challenge-attention badge | VERIFIED LOCALLY | Web C login with incoming direct challenge. |
| Exact badge/list refresh at Block and Inbox Decline/Cancel | DEFERRED | Backend termination tested; full live transition not captured. |
| Find/exact username/profile/Friends/Inbox/history links | VERIFIED LOCALLY | Web, except underscore issue below. |
| Nearby mutual filtering and known-ID block enforcement | VERIFIED LOCALLY | Authenticated API; full Nearby screen visual deferred. |
| Self-profile navigation | REVIEWED IN CODE | Self endpoint case tested; navigation not visually exercised. |
| Literal underscore discovery | VERIFIED LOCALLY | Authorized search correction: 27 authenticated local scenarios passed; resolved locally, not deployed. |
| Direct challenge → accept → submit → confirm → rematch | VERIFIED LOCALLY | Authenticated B/C web loop. |
| Open creation → discovery → join | VERIFIED LOCALLY | Authenticated B/D web loop. |
| Generic composer, challenge decline/cancel | DEFERRED | Generic blocked endpoint covered by API; complete unblocked web paths not rerun. |
| Confirmed W/L, XP, rating, history, rivalry | VERIFIED LOCALLY | Web results/profile plus API data comparison. |
| Confirmed draw progression | VERIFIED LOCALLY | Additional 24-assertion authenticated API test; draw UI deferred. |
| Blocked direct/generic/rematch/accept/open join | VERIFIED LOCALLY | API suites; stale rematch UI safely failed. Stale Quick Match Join UI deferred. |
| Accepted-match submission/confirmation after block | VERIFIED LOCALLY | API win/draw tests; accepted match is not canceled by block. |
| Dispute/reject after block | VERIFIED LOCALLY | API: opponent allowed, third party denied, progression unchanged. UI deferred. |
| Database/social/block-enforcement security suites | VERIFIED LOCALLY | 79 / 124 / 120 assertions passed in this run. |
| Actor IDs, grants/RLS, pair locking, allowlists | VERIFIED LOCALLY | Relevant backend assertions plus code review. |
| Opponent Profile auth/IDs/sports/record/rating/privacy | VERIFIED LOCALLY | Authenticated API and response-key checks; selected web states. |
| Native iOS/Android | DEFERRED | Expo Go local project remained at opening screen; Android tooling absent. |
| Button labels/roles/busy/disabled semantics | VERIFIED LOCALLY | Nine renderer cases and web semantic buttons after fix. |
| Touch-size/confirmation/scroll structure | REVIEWED IN CODE | Shared button minimum heights 48/52/56; native layout not established. |
| Screen reader, keyboard, small-screen clipping/safe area | DEFERRED | No complete native/mobile accessibility pass. |
| Network/stale state/duplicates/concurrency | VERIFIED LOCALLY | Mocked component failures and existing backend concurrency coverage. |
| Same-lifetime Inbox refresh ordering | VERIFIED LOCALLY | September 29 correction: four failing pre-fix regressions; 24 focused scenarios passed afterward. |
| TypeScript and whitespace | VERIFIED LOCALLY | Original QA and September 29 checkpoint typecheck/diff check passed. |

## Local Test Environment

Testing used an isolated disposable local Supabase stack. A separate pre-existing baseline stack was not modified or stopped. Reset with `npx supabase@latest db reset --local --no-seed`. Applied the final current social migration `20260922155601_loop_4_2a_friendship_blocking_foundation.sql`; its disposable copy was byte-identical. The established disposable reference-preconditions bridge was needed before canonical migrations. Local functions matched repository functions and ran through `functions serve --no-verify-jwt`; handlers enforce authentication themselves.

Expo web ran locally from the authorized worktree. A process-only launcher set `EXPO_NO_DOTENV=1` and the disposable local URL/key, with an exact local URL guard. No production env file was changed. Dependencies were a temporary real copy from frozen Loop 3 after lockfile hash comparison, not a symlink. React 19.1 renderer dependencies were installed only in a temporary harness directory.

Controlled app users QA42F A/B/C/D used local-only `@rival.local` accounts with distinct auth and canonical profile IDs, active pickleball, Downtown/available-now fixtures and initially zero stats. Additional backend fixtures were disposable. No credentials or session tokens are recorded here.

## Friendship Lifecycle

Authenticated A found B by exact username, opened Opponent Profile and sent a request. A's Sent count was 1 without an incoming attention badge. B signed in, saw attention 1 and incoming A, navigated from Inbox to A and accepted. Friends state and cleared incoming requests were observed. Removal subsequently returned the profile to Add Friend, but the confirmation tooling did not reliably expose Cancel/Confirm, and a both-sided post-removal visual pass was not completed.

D sent B a request, canceled it through Opponent Profile, then sent again. An authenticated reciprocal SEND from B accepted it; both accounts subsequently showed Friends and each other in their Friends lists. No duplicate reciprocal-send UI was added. Decline, seven-day retry restriction and duplicate behavior passed the social API suite; the current web cooldown/Retry and Inbox Decline/Cancel paths remain deferred.

## Blocking Lifecycle

B blocked A and the profile became generically unavailable. A's reciprocal block was created through the authenticated API; B also blocked C to exercise multiple owned rows. B's Blocked Players screen showed A and C. The suites verified owner-only lists/removal, reverse block persistence, both-direction discovery/profile restrictions, ended friendship/requests, canceled pending direct challenges and no restoration on unblock. They also verified that accepted matches and progression data are preserved. UI messages did not reveal the blocking initiator in the observed unavailable/rematch paths.

## Immediate Unblock UI Transition

In one authenticated B screen/session, unblocking C removed C while A remained. Unblocking A then showed the empty state with busy state cleared. No fresh tab, reload or restart was used between these list transitions. A's independent block of B remained effective in backend coverage.

Unblock confirmation text was captured, but browser dialog APIs could not reliably access the actual Cancel/Confirm controls. The observed row transitions are valid visual evidence; they do not establish Cancel behavior or reliable explicit confirmation-control interaction. Component tests separately verified Cancel does not mutate and confirmed success refreshes once. A later Remove Friend dialog had the same tool limitation. On resumption the QA tab was absent, so its pending cancellation could not be verified. These checks remain DEFERRED.

## Account-Switch and Stale-Response Safety

Two failures were reproduced with deferred promises against actual React components: a post-mutation FriendRequestsPanel fetch could overwrite a new account's request list, and an Opponent Profile friendship refresh could overwrite a new account's relationship. Both tests failed before the fixes and passed afterward.

FriendRequestsPanel now binds async work to account/focus lifetime, hides data belonging to a different loaded user, and prevents old completions from changing new busy/error state. Opponent Profile extends its existing block lifetime guard to friendship mutations and their refresh/error/finally paths. No service/backend behavior changed.

Tests covered delayed lists/mutations, old confirmations, account switch, blur/refocus, unmount and old completion versus a new operation. Ordinary web logout/login across A/B/C/D was exercised. Precisely timed delayed-response cases are component evidence, not authenticated multi-device visual evidence.

## Inbox and Badge

Web verification covered incoming and outgoing friend requests, profile identity navigation, acceptance, incoming-only attention and clearing after acceptance. The existing challenge badge appeared for C's incoming challenge. Backend tests establish termination of requests on Block. The exact live Block → request-list/badge transition, plus current Inbox Decline/Cancel actions, remain deferred.

## Discovery and Opponent Profile

Web Find Player/exact username, Friends and Inbox profile links, and history profile navigation were exercised. Blocked history navigation showed a generic unavailable profile while preserving match history. API tests cover mutual search/Nearby filtering and known-ID access. Self routing is implemented in OpponentProfileScreen; self API access is covered, but the navigation itself was not visually tested. The full ordinary Nearby screen is not claimed as a visual pass.

## Username Underscore Severity Assessment

Originally FAILED during the initial QA; now RESOLVED LOCALLY — NOT DEPLOYED by the subsequent authorized search correction below. At the previous checkpoint, `supabase/functions/search-profiles/index.ts` removed `%` and `_` from the query before username `ilike`. Onboarding permits underscores: display-name validation trims and requires a minimum length, and `src/services/userService.ts:361` stores it as username without excluding `_`.

An authenticated test created a literal underscore username and a second username with that underscore removed. Searching the literal username missed the intended player and returned the stripped-name player. This is query transformation causing a false negative and false positive; it is not `_` expanding as a wildcard, because `_` is removed first. Backslash behavior was not tested in that original assessment; the correction pass below now covers it.

The original assessment rated the issue P2 for launch discoverability, without a demonstrated authorization bypass, and recommended a separate scoped correction. Search code was deliberately unchanged in the original QA and UI checkpoint. The later authorized search correction implements and verifies literal matching; production remains unchanged.

## Competitive Loop Regression

B discovered C, sent a direct pickleball challenge with the correct opponent/sport prefill, and C accepted. C submitted an 11–7 win; B reviewed and confirmed. B's completion showed +100 XP, total 100, Level 1 and 0 wins/1 loss/0 draws/1 played. History retained the score and loss; rivalry showed 0–1–0. Post-result Challenge Again opened the correct C/pickleball composer. B's public pickleball rating later displayed 1184. Backend comparisons checked authoritative record/rating fields.

B created an open pickleball challenge; D discovered it in Play Now and joined, producing an accepted B/D challenge. Complete unblocked generic-composer and challenge decline/cancel web regressions remain deferred. Loop 3 progression code was not changed.

## Blocked Competitive Paths

With B's rematch composer open, C blocked B through the authenticated API. B's Send failed safely with generic `Opponent profile not found`, no success state, and a reenabled action. The backend suite covered direct and generic creation, pending direct acceptance, both-direction discovery, open discovery and known-ID joining. Stale Quick Match Join was not repeated visually in this run and is not counted from historical evidence.

## Accepted Match and Dispute/Reject Behaviour

Current backend tests verified submission and confirmation of a previously accepted match after a block, with history/progression preserved and normal completion. A focused reject test allowed the opponent to dispute, rejected a third party (409), left the challenge accepted and stats/XP unchanged, then rejected confirmation of the disputed result (409).

A further authenticated draw test passed 24 assertions: accept, block, submit draw, confirm, both records 0–0–1/1 played with positive XP, and challenge completed. Its first run had an incorrect test expectation that confirmed challenges remain accepted; the existing security migration explicitly transitions them to completed. Correcting that test expectation produced a pass; no application change was required. Draw and dispute UI flows remain deferred.

## Backend Security Suites

The following counts belong to the original September 23–24 QA run. They were new executions then and were not rerun during the September 29 UI-only checkpoint correction:

| Command (disposable root) | Result |
| --- | --- |
| `npx supabase@latest test db supabase/tests/database/loop_4_2a_friendship_blocking.test.sql` | PASS, 79 assertions |
| `node /Users/evanlister/rival-loop-04-social-community/supabase/tests/functions/social-api.test.mjs` | PASS, 124 assertions |
| `SUPABASE_CLI_PATH=<temporary latest-CLI wrapper> node /Users/evanlister/rival-loop-04-social-community/supabase/tests/functions/block-enforcement.test.mjs` | PASS, 120 assertions |
| Temporary profile/search/dispute integration script | PASS, 41 assertions (includes assertions reproducing the known search defect) |
| Temporary draw integration script | PASS, 24 assertions |

The disposable pgTAP copy used a local dblink host/port/password connection adjustment; repository test SQL was not changed. The latest-CLI wrapper was needed because the installed older CLI could not parse the established config. Assertions include fixture/setup checks; counts are not numbers of independent user flows.

Review confirmed authenticated getUser actor derivation, profiles.auth_user_id canonical mapping, strict input keys, service-role-only social RPCs, RLS/grants and prohibited client writes. Pair advisory locks use canonical ordering before challenge row locks; final database guards cover concurrent Block/accept/join. Pending direct challenges are canceled while accepted matches and ledgers remain intact. Block lists are caller-owned and public profile responses are allowlisted.

## Opponent Profile Data Security

API verification covered absent/invalid auth (401), missing/malformed IDs (400), nonexistent/blocked opponents, self handling, no active sports, Unrated and record/rating comparisons. Expected response: `profile` with `id`, `username`, `displayName`, `area`, `sports`, `record`; sports expose `sport`, `selfAssessedSkill`, `skillRating`; record exposes wins/losses/draws/matchesPlayed. No email, auth UID, coordinates, radius or private block fields were exposed by the checked responses. Production-specific response verification remains a separate deployment-stage task.

## Native/Mobile QA

An iPhone 17 Pro simulator on iOS 26.4 and Expo Go 54.0.7 were available. Opening the disposable local Expo project remained at “Opening project”/taking longer. The local iOS manifest returned HTTP 200 with the local launch asset, but authenticated native app access was not established. Android tooling was absent. No production endpoints were substituted and no unrelated native rebuild was attempted. All native controls/navigation/touch/scroll/loading checks remain DEFERRED.

## Accessibility

Confirmed defect: the three shared button implementations lacked explicit button role/state; loading replaced text with a spinner and lost the action's accessible name. Added role, stable label, and disabled/busy accessibility state to each underlying Pressable. Nine actual-component cases (normal/loading/disabled × three buttons) passed; the role test failed before the fix. Authenticated web DOM subsequently exposed named button controls.

Code review found minimum button heights of 48, 52 and 56, descriptive action labels, confirmation text, labeled list loading states and wrapping blocked rows. Empty and normal states were visually observed. Actual screen-reader announcement quality, keyboard traversal, small viewport clipping, native safe-area/scroll behavior and all touch targets remain unverified. This is not a complete accessibility certification.

## Network and Concurrency

Temporary React 19.1 renderer harnesses loaded actual components with mocked services and controllable promises: 18 network/Block/Unblock/lifecycle cases, five Inbox cases, one Opponent Profile stale-refresh case and nine button cases; 33 distinct scenarios passed after the fixes and again at final validation. The original 14 lifecycle cases are included in the 18, not counted twice.

Coverage includes failed friendship/Block/Unblock, refresh failure/Retry, stale incoming request, remote acceptance superseding a stale failure, duplicate mutation attempts, old account responses/confirmations, blur and unmount. Existing database tests cover supported request/block concurrency. These tests do not simulate a physical network loss or two real devices. Harness dependencies and local environment artifacts are removed during cleanup; no broad testing infrastructure was added.

## Confirmed Defects and Fixes

1. Cross-account request refresh could expose old request rows. Fixed with request-panel lifetime and loaded-account guards.
2. Cross-account friendship refresh could replace current relationship state. Fixed by applying Opponent Profile's action lifetime guard throughout mutation completion paths.
3. Missing accessible button role/state/name while busy. Fixed in the three shared button implementations.

The original UI-only pass intentionally left underscore search unchanged and made no database, Edge Function, dependency manifest, lockfile, progression or production configuration changes. The subsequent authorized search correction changes only the search Edge Function, adds durable tests and updates this report, as detailed below.

## Remaining Verification Gaps

Authenticated visual Cancel for Unblock/Block/Remove Friend and reliable explicit Confirm interaction; both-sided removal outcome; Inbox Decline/Cancel and cooldown/Retry; exact live badge/request refresh at Block; full Nearby and self routing; unblocked generic challenge/decline/cancel; stale Quick Match Join; draw/dispute UI; native/mobile accessibility and layout. Delayed-response and simulated remote-change tests are component tests, not real-device visual tests. Literal username search is now corrected locally; the remaining visual/native gaps still prevent a complete local QA classification.

## September 29 Checkpoint Correction

Repository preflight matched the authorized branch, expected starting HEAD and exactly five modified source files plus this report, with an empty index. Frozen Loop 3 was clean at its expected HEAD. The original checkout had pre-existing changes in challengeService.ts, matchService.ts and an untracked Loop 3 migration; they were not modified by this task.

### Reproduction and narrow correction

The previous checkpoint review identified a same-account/same-focus race in FriendRequestsPanel. With Accept pending, an AppState refresh can capture an old incoming request. Accept then completes and its post-mutation fetch returns the current list. Resolving the earlier AppState fetch afterward restored stale rows because both reads shared an active lifetime. An old error could similarly replace success. The reverse overlap (a newer foreground read overtaking a post-mutation read) also lacked ordering, and a stale post-mutation error could start a recovery fetch over newer success.

A temporary React 19.1/react-test-renderer harness loaded the actual TSX components with mocked services and controllable promises. Before source correction, 22 scenarios ran: 18 passed and four failed, covering old AppState result/error, old post-mutation result, and stale post-mutation rejection launching recovery. Two further busy/recovery cases were added after correction. These are component tests, not authenticated visual or backend tests.

FriendRequestsPanel now maintains a monotonically increasing refresh sequence inside each account/focus lifetime. Mutation start invalidates preceding reads. Effect, post-mutation and recovery reads each acquire a sequence; success and error paths apply only for the active lifetime's newest sequence. A stale rejection cannot launch another recovery read. Existing lifetime cleanup and mutation locking remain in place. Finally handlers remain lifetime-guarded; a second mutation cannot start within that lifetime until the first releases its lock, and an old account's completion cannot release a new account's lock. No polling, service changes or redesign were introduced.

### New focused evidence — 24 scenarios PASS

Nineteen FriendRequestsPanel cases covered:

- Older AppState success and error arriving after the authoritative post-mutation result.
- A newer AppState result superseding an old post-mutation result or rejection.
- Stale recovery error after newer success.
- Old finally versus a new account's busy mutation, and stale read error versus a later same-account busy mutation.
- Immediate old-account row hiding, delayed list and delayed post-mutation response after account switch.
- Blur/refocus, blur during mutation failure, and unmount during reads or mutations.
- Duplicate mutation prevention, remote acceptance removing a stale incoming row after failure, ordinary newest refresh, current error/Retry, outgoing Cancel and incoming Decline.

Five Opponent Profile cases covered initial relationship loading, Retry loading, remote acceptance after a failed send, duplicate mutation protection and old mutation refresh after an account switch.

### Opponent Profile same-lifetime review

No analogous overlapping friendship-read/mutation path was found in the current UI control flow. Initial and Retry reads set relationship to null and hide friendship mutation controls. A pending mutation holds mutationLock and relationshipBusy; Retry is disabled, duplicate mutations are rejected, and its post-mutation relationship read completes before the lock is released. Effect cleanup invalidates superseded effect reads. There is no AppState relationship refresh in this component. The five focused cases exercised these control boundaries and the existing cross-account protection. Block is separately locked; its success removes the profile, and a late relationship-only response cannot repopulate the profile. No additional Opponent Profile correction was needed in this pass; its previously reviewed cross-account fix remains part of the checkpoint.

The historical 33 component scenarios and 79/124/120 backend plus 65 additional integration assertions are preserved as earlier evidence. They are not added to the 24 new scenarios or represented as new executions. No disposable Supabase, native or visual QA environment was rebuilt. At that UI checkpoint, the underscore-search defect and all deferred QA gaps remained unchanged. The later search correction below resolves only the search defect locally.

Disposable endpoint values, ports and temporary stack identifiers were generalized while retaining methodology. This correction changes only FriendRequestsPanel and this report beyond the five source changes already under review. Temporary harness dependencies and the temporary matching application dependency copy are removed before staging. The local checkpoint is authorized by the September 29 correction request; it does not upgrade the classification or authorize deployment or 4.2F-2.

## Authorized Literal Username Search Correction

Starting state: clean `codex/loop-04-social-community` at `0d923fbcdbaeeb02e37b7b781510d486e475d78f`, empty index; frozen Loop 3 clean at its expected HEAD. Scope is the search endpoint, a durable authenticated function test and this QA report. No remaining visual/native QA or 4.2F-2 work was started.

### Root cause and query contract

The endpoint trimmed input, removed percent/underscore characters, then wrapped the altered query in ILIKE substring wildcards. Valid underscore usernames could be missed or replaced by stripped-name neighbors. Backslashes were passed through to LIKE escaping, and PostgREST also recognizes asterisk as a LIKE wildcard alias, causing additional incorrect matches. Onboarding permits these literal characters; changing username creation rules would not correct discovery.

The corrected query preserves trimmed input and uses the Supabase client's fixed `imatch` operator with PostgreSQL's `***=` literal-pattern director. Every character after that trusted prefix is literal, including underscore, percent, backslash, asterisk and regex syntax. The operator remains case-insensitive and matches substrings without adding user-controlled pattern operators. There is no raw SQL interpolation or new RPC/migration. This avoids PostgREST's asterisk-to-percent LIKE alias as well as SQL LIKE escape handling. See the [PostgREST filter contract](https://docs.postgrest.org/en/v14/references/api/tables_views.html) and [PostgreSQL literal-pattern contract](https://www.postgresql.org/docs/18/functions-matching.html#POSIX-METASYNTAX).

The two-character minimum now applies to the actual trimmed literal query, rather than a query with valid characters deleted. There was no endpoint maximum query length; none was introduced. A 2,048-character no-match query was exercised successfully, not an assertion that transport/database limits do not exist. NUL is newly rejected with HTTP 400 and a generic invalid-query message, since PostgreSQL text cannot represent it; the old endpoint returned 200 for the malformed test input. Missing/invalid authentication still denies access with the existing HTTP 500 status. All internal exception/database messages now return the generic `Unable to search profiles` response rather than exposing query details. The existing missing-canonical-profile 404 remains unchanged.

### Durable regression and failing-before evidence

Added `supabase/tests/functions/search-profiles.test.mjs`, following the existing CLI-status/authenticated-function approach. Run it from an isolated disposable local Supabase project with the repository's functions served, optionally setting `SUPABASE_CLI_PATH` to the current CLI executable. The runner rejects non-loopback API destinations, creates unique synthetic accounts/profiles, keeps generated credentials in memory, and deletes its auth/profile fixtures in finally. It reports completion only after cleanup succeeds. No real credentials, disposable endpoint values or environment configuration are stored in the test or report.

The final pre-fix regression suite ran against the unchanged function: **13 scenarios passed, 14 failed**, with 312 assertions reached including fixture/status/cleanup checks. Failures demonstrated the single/multiple underscore, literal case/substring/trim, percent, backslash/trailing-backslash, asterisk, accented username, malformed NUL and blocked-search/result-neighbor cases. Some blocked-search failures reflected a substituted stripped neighbor rather than discovery of the blocked canonical profile; the evidence does not establish an authorization bypass in the old version.

After correction: **27 scenarios passed, zero failed; 326 assertions**, including fixture/status/cleanup checks. Coverage:

- Single/multiple underscores, literal case-insensitive exact/substring search and trimming.
- Stripped and single-character wildcard neighbors stay distinct.
- Percent cannot broaden a suffix search or substitute a stripped username.
- Backslash and trailing backslash are preserved without malformed escaping.
- Asterisk, regex punctuation and embedded-option-looking text remain literal.
- Accented case-insensitive input remains supported.
- Missing, empty and one-character input returns the existing empty response; long no-match input remains bounded.
- Malformed percent/filter/SQL-looking input remains literal; NUL is rejected safely.
- Self exclusion uses the canonical actor despite caller-supplied exclusion hints; incomplete profiles remain excluded.
- Response keys, including nested stats/sports keys, remain exactly allowlisted.
- Missing/invalid authentication, absent canonical profile and unsupported methods remain denied.
- A block filters search in both directions, unrelated neighbors remain discoverable, and unblocking restores the intended result.
- Twenty-two matching fixtures still produce exactly the first twenty ordered results despite a caller-supplied limit hint.

The existing **120-assertion block-enforcement suite was rerun and passed** against the corrected function. This is a new execution, separate from its original QA pass. The original 79 database, 124 social API, 65 additional integration and 33 component results, plus the UI correction's 24 scenarios, remain historical evidence and were not rerun for this backend-only search change.

### Security, environment and validation

Authentication and canonical profile resolution, mutual blocking, self/incomplete-profile exclusion, selected response fields, username ordering and the fixed limit remain intact. Literal pattern mode prevents wildcard/regex injection; the tests exercise reserved filter syntax and backslashes through the real client/PostgREST/database chain. NUL rejection and generic errors prevent malformed input from returning database query details. No authorization grants, RLS, Nearby logic, username creation rules or production settings changed. Performance at production scale was not tested.

Testing used a newly isolated disposable local Supabase stack with current repository migrations/functions. The disposable-only reference-data bridge supplied historical prerequisites; its bucket insert was made idempotent after setup found that the baseline already provided that bucket. No repository migration changed. The pre-existing baseline stack was preserved. No production accounts or data were used.

`npm run typecheck`, `git diff --check` and Node syntax checking of the durable suite passed. The app typecheck excludes Edge Functions; executing the corrected endpoint through the authenticated suite provides the function runtime evidence. No unrelated friendship/component suites were repeated.

The search checkpoint includes exactly:

- `supabase/functions/search-profiles/index.ts`
- `supabase/tests/functions/search-profiles.test.mjs`
- `docs/loop-04-2f-1-qa.md`

Task-owned local services, disposable stack/data, logs, temporary runner/wrapper scripts and the matching temporary dependency copy are removed before checkpointing. No pre-existing service or file is removed. The authorized local commit subject is `Loop 4.2F-1: fix literal username search`; it is not a deployment authorization.

**KNOWN UNDERSCORE USERNAME SEARCH DEFECT: RESOLVED LOCALLY — NOT DEPLOYED.** Overall classification remains **LOOP 4.2F-1 PARTIAL — VERIFICATION GAPS REMAIN**.

## TypeScript and Static Validation

`npm run typecheck` and `git diff --check` passed in the original QA and again after the September 29 correction. The original final run passed 33 component scenarios; the correction pass separately passed 24 focused scenarios. At the UI checkpoint, the three existing backend suites had passed earlier in the QA run and no backend source changes were part of that pass, so no backend reruns were needed then. The later search correction separately reran the relevant 120-assertion block-enforcement suite and the new search suite, as recorded above.

## Files Changed

The UI lifecycle/accessibility checkpoint contained only these six files:

- `src/components/ui/GradientButton.tsx`
- `src/components/ui/SecondaryButton.tsx`
- `src/shared/components/Button.tsx`
- `src/modules/challenges/presentation/FriendRequestsPanel.tsx`
- `src/modules/profile/presentation/OpponentProfileScreen.tsx`
- `docs/loop-04-2f-1-qa.md` (new)

## Production Isolation

PRODUCTION DATABASE MODIFIED: NO

PRODUCTION FUNCTIONS DEPLOYED: NO

PRODUCTION DATA MODIFIED: NO

No production accounts, social fixtures, migration deployment, function deployment, push or merge. Original RIVAL checkout was not modified.

## Final Repository State

Final verification on 2026-09-24: HEAD remains `5ee23635022e25c905a2be64f2f5d2638a80e5a2`; index empty; exactly the five source files above modified and the QA report untracked. No commit, stage, push, merge or deployment. No 4.2F-2 work started.

Stopped the task-owned Expo launcher/server and local function server. `supabase stop --no-backup` stopped only the disposable QA stack and removed its data. Verified the QA web listener had stopped and only the pre-existing baseline stack remained running. Removed the temporary worktree node_modules copy, renderer harness/dependencies, fixture credentials, manifests, scripts and disposable stack directory. Preserved pre-existing `.expo` and `supabase/.temp` files (dated before this QA run). The IAB QA tab was already absent on resumption; a previously opened native Chrome QA tab was not revisited while the user was using Chrome. No production env artifacts were written.

## Frozen Loop 3 Isolation

Final post-cleanup check: frozen worktree is clean at `53fc064d361b565aa793b7929b18379ae4607970`. Its dependencies were read/copied, not modified. Original RIVAL checkout received no task edits.

## Classification

**LOOP 4.2F-1 PARTIAL — VERIFICATION GAPS REMAIN**

No backend security or core competitive-loop regression was observed in the executed tests. Fixed defects need founder review; the remaining verification gaps are not waived; the username-search issue is resolved locally and not deployed. This report makes no production rollout decision.


## Final visual and native verification pass — 2026-09-29 to 2026-10-03

**LOOP 4.2F-1 BLOCKED — DEFECT FOUND**

This section supersedes earlier overall classifications and native-connection deferrals. Verification resumed after a usage interruption. Preflight and resumption confirmed branch `codex/loop-04-social-community`, HEAD `004b5f3cf366d88b21011beca5853c999db978c7`, clean worktree and empty index. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. No application source was changed. The username-search correction remains **RESOLVED LOCALLY — NOT DEPLOYED**.

### Environment and native connection

A fresh disposable local Supabase stack used current migrations/functions and four synthetic accounts. Disposable-only prerequisite sports/storage setup was not added to repository migrations. Expo used a real temporary dependency copy with a matching lockfile, not a symlink. The launcher verified the authorized worktree and explicitly guarded the disposable local backend URL; dotenv loading was disabled and configuration was process-only. Production configuration was not changed.

The iPhone 17 Pro simulator (iOS 26.4, Expo Go SDK 54 client) reached both Metro and the local authentication health endpoint through Safari. A fresh Expo deep link opened the current application and authenticated successfully. Earlier stale Expo content referenced another checkout, but the newly launched process belonged to the authorized worktree. No SDK upgrade, native rebuild or architecture change was made. The prior opening-project blocker is resolved for this environment. Only this simulator/device size was exercised; no physical-device or Android claim is made.

### New product defect — native header safe area and title width

**FAILED — authenticated native visual evidence; P2, material native release-quality blocker.** The custom navigation title is partially underneath the Dynamic Island/status-bar region. Longer titles are also severely truncated. Reproduced independently on Home, Find Player, Opponent Profile, Friends, owner Profile, Inbox (Challenges), and Blocked Players. This persisted across normal navigation and after dismissing the development warning overlay. For example, Friends displays only a short `Frie...` fragment under the island, and Blocked Players displays `Bloc...`; even Home has its upper portion obscured. Body text and the native confirmation dialogs remain readable.

Reproduction: open the current app in the named simulator; sign into a synthetic local account; navigate Home → Find Player → View Profile, or Profile → Friends/Blocked Players; inspect the centered header title. Expected: a readable title below the status-bar/cutout with sufficient width. Actual: cutout overlap and extreme truncation. Screenshots and accessibility observations were captured in the task conversation; no credential-bearing screenshot artifact was added to the repository.

Likely source area (code review, not a proven fix): `src/components/ui/Header.tsx` uses a fixed minimum height and padding without a native top-safe-area inset, and an absolutely positioned title with fixed 168-unit left/right zones. `src/application/navigation/RootNavigator.tsx` installs this custom header for tab and stack screens. This is shared navigation chrome, not a social backend failure. Correcting it requires a separately approved native layout change and representative re-verification. No fix was implemented. Completion is blocked; the rest of the unexecuted matrix is retained below rather than represented as passed.

### Targeted results and remaining gaps

| Requested scenario | Classification / evidence surface | New outcome and precise remaining boundary |
| --- | --- | --- |
| A: Web Block/Unblock/Remove Friend Cancel and Confirm | DEFERRED — web dialogs; partial authenticated web observation | Remove Friend emitted the correct confirmation text, but the browser action was interrupted and the dialog API returned no active handle. The friendship subsequently disappeared. This proves the resulting UI transition, not explicit Cancel/Confirm control handling. Exact mutation counts, busy timing and repeated-activation prevention were not newly established. Web Block/Unblock dialog gaps remain. |
| A: Native Block Cancel and Confirm | VERIFIED LOCALLY — authenticated native, normal single activation | Actual dialog exposed named Cancel and Block Player controls and readable explanation. Cancel returned to the unchanged actionable profile; reopening remained usable. Explicit Confirm led to generic profile-unavailable state without restart. No instrumented exactly-once or rapid-repeat claim. |
| A: Native Unblock Cancel and Confirm | VERIFIED LOCALLY — authenticated native, normal single activation | Actual Cancel retained the blocked row. Reopening and explicit Unblock removed the row on the same screen and showed No blocked players, without manual reload. Named dialog controls and explanatory text were readable. Rapid-repeat/busy-window instrumentation remains deferred. |
| A: Native Remove Friend dialog | DEFERRED | Not exercised before closing the pass on the native layout defect. |
| B: Both-sided friend removal | VERIFIED LOCALLY — mixed authenticated web/native | Accounts started as accepted friends. After removal, both opponent profiles showed Add Friend. A's web Friends list and B's native Friends list both showed No friends yet. Both-sided web-only list coverage remains deferred; native evidence is not relabeled as web. |
| C: Incoming Decline | VERIFIED LOCALLY — authenticated native, row/count portion | B's Inbox showed Incoming (1), A's identity, Accept and Decline. Decline removed the row and changed Incoming to (0) immediately. A's web opponent view subsequently showed Add Friend and its Inbox refreshed to Sent (0) on return. Full before/after header attention-badge measurement and web recipient Decline remain DEFERRED. |
| C: Outgoing Inbox Cancel | VERIFIED LOCALLY — authenticated web, row/count portion | A sent C a request through Opponent Profile. Inbox showed Incoming (0), Sent (1), and named Cancel request to C. Cancel immediately changed Sent to (0), removing the row. No incoming attention was displayed for that outgoing request. Post-cancel opponent-profile reinspection and native outgoing Cancel remain DEFERRED. |
| D: Decline cooldown / Retry | VERIFIED LOCALLY — authenticated web feedback/recovery | After native decline, web immediate resend displayed Please wait before sending another friend request. Retry Friendship restored Add Friend and usable controls. Returning to Inbox showed no sent request. No time manipulation or broad backend rerun; seven-day duration enforcement remains historical API evidence. |
| E: Live incoming request → Block → Inbox/badge refresh | DEFERRED | Native Block was verified after decline, not with an actionable incoming request. Do not use this as proof of the requested live termination/badge sequence. |
| F: Ordinary Nearby screen | DEFERRED | Home discovery showed eligible synthetic players and removed the blocked pair on return to Home on both surfaces, but the dedicated Nearby screen, profile selection and back sequence were not exercised. |
| G: Self-route guard | REVIEWED IN CODE; visual case DEFERRED | Owner Profile opened normally, but no route resolving self through an opponent path was exercised. |
| H: Generic challenge create / recipient decline / sender cancel | DEFERRED | Not newly exercised before closing on the native defect. Historical direct-challenge evidence is not a substitute. |
| I: Stale Quick Match Join, including blocked pair | DEFERRED | Not newly exercised. Historical API coverage remains separate. |
| J: Complete draw UI / XP / history / rivalry | DEFERRED | Not newly exercised. No backend correctness result is relabeled as visual evidence. |
| K: Dispute/reject UI / unauthorized participant / progression | DEFERRED | Not newly exercised. No dispute-lifecycle changes. |
| Native Find Player → Opponent Profile / request state / back | VERIFIED LOCALLY — authenticated native | Exact username search returned the correct synthetic account; profile identity/record/actions appeared. Incoming request controls appeared after a web send. Back returned through Find Player, Friends and owner Profile normally. Native Add Friend send, acceptance, challenge/rematch entry and broader lifecycle timing remain DEFERRED. |
| Native safe area/title clipping | FAILED — authenticated native | Reproduced shared-header defect described above. Body/empty-state/dialog text remained readable in inspected screens. |

### Accessibility and tool limitations

Native social actions and confirmation controls generally exposed meaningful names and button roles: View Profile, Add Friend, Decline, Block Player, Cancel and Unblock. Empty Friends, Inbox and Blocked Players states were understandable. Blocked-list Unblock appeared as an accessibility element rather than a button in the available tree, so complete role conformance is not claimed. Back controls also lacked a meaningful name in the observed tree. Web Cancel-request and Retry controls exposed meaningful names and button roles. Native dialog text wrapped within the visible alert and both controls were usable.

**DEFERRED:** VoiceOver/screen-reader traversal, complete keyboard/focus order, live busy-name/disabled-state timing, rapid activation, software-keyboard avoidance, comprehensive scrolling/touch-target measurements, additional mobile dimensions, Android and physical devices. Native text-entry via accessibility values worked, but is not proof of keyboard usability. The native safe-area/title check explicitly failed; this is not accessibility certification.

The browser's JavaScript confirmation interruption/no-handle behavior is a **TEST/TOOL LIMITATION**, not evidence that the product auto-confirms. Synthetic accounts without uploaded avatars generated development-only image-load warnings; the overlay sometimes obscured native tab taps and was dismissed to continue. That is a **TEST ENVIRONMENT LIMITATION**; no production avatar diagnosis is inferred. Native clipboard paste was unreliable, so subsequent local address entry used verified accessibility values. No app source or permissions were changed to bypass these limitations.

### Validation and finalization

`npm run typecheck` passed in this pass. Broad backend suites were not rerun: the previous 79 database assertions, 124 social API assertions, 120 block-enforcement assertions and 27 username-search scenarios / 326 assertions remain historical executions. No new test counts are implied by this report.

Only `docs/loop-04-2f-1-qa.md` is intentionally modified for this pass, unstaged. No source fix, staging, commit, push, merge, deployment or 4.2F-2 work is authorized by this result. Final cleanup and repository checks are recorded below.


Final cleanup completed: stopped the exact task-owned Expo processes; stopped and removed the disposable Supabase data with no backup; verified only the pre-existing baseline stack remained and the QA web listener was absent. Removed the temporary dependency copy, fixture credentials, launcher/fixture scripts, disposable directory and task logs. Closed the task-created web tab. Pre-existing services/files were preserved. No production service was used for mutating QA.

Final repository checks: `git diff --check` passed; authorized branch and HEAD remain unchanged at `004b5f3cf366d88b21011beca5853c999db978c7`; index empty; only this QA report is modified and unstaged. Frozen Loop 3 remains clean at `53fc064d361b565aa793b7929b18379ae4607970`. No new commit was created. The working tree is intentionally not clean because of this documentation change.

PRODUCTION DATABASE MODIFIED: NO

PRODUCTION FUNCTIONS DEPLOYED: NO

PRODUCTION DATA MODIFIED: NO

PUSH PERFORMED: NO

MERGE PERFORMED: NO

4.2F-2 STARTED: NO

Stopped for founder review. Native header correction and the remaining visual/native checks require a subsequent authorized pass; this result does not waive them.


## Authorized native header correction — 2026-10-03 to 2026-10-05

**Native Dynamic Island overlap/title truncation: RESOLVED LOCALLY — NOT DEPLOYED.**

**Overall: LOOP 4.2F-1 PARTIAL — VERIFICATION GAPS REMAIN.**

### Preflight, reproduction and root cause

Preflight confirmed the authorized Loop 4 worktree/branch at `004b5f3cf366d88b21011beca5853c999db978c7`, with only this QA report modified and an empty index. Resumption showed only the intended Header source change plus this report. Frozen Loop 3 remained clean at its expected HEAD. The earlier report was preserved.

Before editing, the unchanged simulator app reproduced the shared defect on pushed Blocked Players and tab-root Profile. Both centered titles were partly hidden under the Dynamic Island and abbreviated. Back and branding remained visible; the prior pass also reproduced Home, Inbox, Friends, Find Player and Opponent Profile. The old disposable backend was stopped, so these initial reproductions used the already-loaded UI and are layout evidence only, not fresh backend verification.

Code review found the common cause in `src/components/ui/Header.tsx`: the custom header did not consume native safe-area insets, and its absolute title occupied only the space between fixed 168-point side zones. The title was centered across the entire header height while the brand/action row used top padding, placing them at different vertical positions. Native narrow widths left insufficient space for titles. `RootNavigator.tsx` supplies this same custom header to both tab roots and pushed screens; no screen-specific override caused the defect. History showed the existing Header implementation came from the initial commit, with no later Header-specific patch to preserve or reapply.

### Exact correction and scope

Only `src/components/ui/Header.tsx` changed in application source. It now reads `useSafeAreaInsets()` from the already-installed provider. Native headers reserve a full-width, centered 24-point title area beginning at the reported top inset plus the existing smallest spacing token. The brand/back/action row begins after that title space; the native minimum height is the larger of the prior minimum and the top inset plus the compact title/control content. These are content dimensions, not a hard-coded Dynamic Island offset.

The original gradient, title font/color/weight, RIVAL font/size, leading horizontal placement, back-control dimensions/handler and right action placement remain unchanged. The title's separate native width resolves truncation without shifting the logo toward the center. Web retains the original style values. Native Android uses the same inset-based mechanism, but no Android visual claim is made. No screen layout, MainLayout, card spacing, navigation architecture, backend, authentication, environment file, dependency version, lockfile, SDK or generated native project changed.

### Authenticated native after-correction evidence

Surface: Expo Go SDK 54 on iPhone 17 Pro / iOS 26.4, portrait. Screenshots/accessibility observations are in the task conversation. The fresh Expo launcher verified this worktree and a disposable local backend with dotenv disabled and process-only configuration. Synthetic local users supplied accepted-friend, incoming-request and blocked-list states. The real temporary dependency copy matched the lockfile; no symlink or package upgrade was used. Disposable prerequisite-seed corrections were outside the repository.

| Screen | Result and boundary |
| --- | --- |
| Home | Full Home title below the island, centered with original typography. RIVAL remains left-aligned at the original horizontal position/size, with no logo/title overlap; right mail action remains visible. Header height grows only to accommodate safe content. The existing gap between header and first card and the spacing between cards remain unchanged; cards are not compressed. |
| Inbox | Full Challenges title and right mail icon visible. Incoming friend-request card starts below the header with its prior spacing and readable controls. Scrolling was attempted but not verified; see limitation below. |
| Profile | Full title visible. Friends and Blocked Players entries open correctly. Account/stat card spacing remains unchanged. |
| Find Player | Full title and back control visible; search position relative to header preserved. Synthetic username produced the correct result. Software keyboard was explicitly shown; search field/header remained visible, Delete and a letter key edited the query, and Return dismissed the keyboard. Direct automated typing was unreliable, so the full query was initially set through the accessibility field. |
| Opponent Profile | Full long title without ellipsis or cutout overlap. Back control works, identity/record and Challenge remain available. Challenge opens the composer. Friendship actions remain in the accessibility tree; comprehensive gesture-based reachability is not claimed. |
| Friends | Full title/back control in both populated and empty states. A disposable fixture transition supplied the empty list. Row navigation opened the correct opponent, and back returned normally. Neither a short populated list nor the empty list establishes long-list scrolling. |
| Blocked Players | Full long title/back control; blocked identity and named Unblock control fit visibly without clipping. Back returns to Profile. No unrelated unblock lifecycle rerun. |
| Send Challenge | Both locked-opponent and generic composer headers are fully visible. Back works and match-setup content retains its spacing. This screen has no right header action configured. No challenge was sent in this scoped pass. |

No observed native title remained clipped. Search-result body text wrapped narrowly in its pre-existing card layout; this source change does not alter that card or its width. This observation is not represented as a header regression or silently corrected.

### Web regression and remaining validation uncertainty

Authenticated web screenshots verified Home, Inbox, Profile and Opponent Profile at the existing desktop viewport. All four preserve the original header height, left RIVAL placement, centered title, back/action positions where present, and body/card spacing. No duplicated safe-area padding, extra whitespace or content compression was observed. This was a representative layout check, not a rerun of the broader web suite.

**TEST/TOOL LIMITATION:** Native scroll and drag calls on Inbox and the composer produced no visible content movement. This does not distinguish input-delivery limitations from product scrolling behavior and is not recorded as a pass or a proven new defect. Native scrolling (including Friends/Blocked Players long-list behavior) therefore remains DEFERRED. Accessibility activation did reach controls outside the visible viewport, but it is not a substitute for gesture scrolling.

Additional iPhone simulator definitions were installed but shut down. A quick existing-device launch attempt through the Simulator menu failed with an invalid accessibility element; no second active session was established. No new runtime or native build was created. Additional size, Android, landscape and physical-device checks remain DEFERRED. Only the existing Dynamic Island device is verified.

The synthetic accounts had no avatar uploads, producing development image-load overlays; these were dismissed when they obscured navigation. Reloading against a new disposable backend initially invalidated the previous local refresh token; fresh synthetic login succeeded. Neither condition was bypassed by switching to production.

### Validation, checkpoint decision and remaining Loop 4.2F-1 gaps

`npm run typecheck` passed on the final source, and `git diff --check` passed. No directly relevant navigation test suite exists in this repository; no new broad infrastructure or backend suite was run. Historical backend counts remain historical.

**NO COMMIT / NO STAGING:** The header defect itself is resolved in the inspected native screens and representative web checks pass, but required native scrolling evidence remains uncertain. The founder's checkpoint rule explicitly requires leaving changes unstaged when meaningful uncertainty remains. Exactly two intended files are modified: `src/components/ui/Header.tsx` and `docs/loop-04-2f-1-qa.md`. No commit hash exists for this correction; starting HEAD remains unchanged.

Remaining broader gaps are not automatically resumed: reliable web Cancel/Confirm and rapid-repeat/busy timing; full live Block-to-Inbox/badge refresh; both-sided web-only removal coverage and post-cancel state details; dedicated Nearby/self-route flows; generic challenge create/decline/cancel; stale Quick Match Join; full draw/XP/history/rivalry UI; dispute/reject and unauthorized-participant UI; remaining native social interactions and complete accessibility/VoiceOver/focus coverage. This header pass does not close those scenarios through incidental navigation.


Header-pass cleanup completed: exact task-owned Expo processes stopped; disposable Supabase stack/data removed without backup; only the pre-existing baseline stack remains running; QA web listener absent. Temporary dependency copy, fixture files, scripts, logs and disposable directory removed. Task-created browser tab closed. No pre-existing services/files removed.

Final header-pass repository status: only Header source and this report modified, both unstaged; index empty; HEAD `004b5f3cf366d88b21011beca5853c999db978c7`. Final diff-check passed. Frozen Loop 3 clean at `53fc064d361b565aa793b7929b18379ae4607970`. No commit created.

PRODUCTION DATABASE MODIFIED: NO

PRODUCTION FUNCTIONS DEPLOYED: NO

PRODUCTION DATA MODIFIED: NO

PUSH PERFORMED: NO

MERGE PERFORMED: NO

4.2F-2 STARTED: NO

Stopped for founder review; remaining QA was not automatically continued.


## Authorized header checkpoint review — 2026-10-05

The founder explicitly authorized checkpointing the verified header correction while retaining native scrolling and second-device coverage as DEFERRED. This supersedes the earlier no-commit decision; it does not upgrade those checks or authorize further QA.

Preflight matched branch `codex/loop-04-social-community` at `004b5f3cf366d88b21011beca5853c999db978c7`, exactly Header.tsx and this report modified/unstaged, and an empty index. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. The original checkout remained at `6fb91d9b1c2c912dd3730d463a817194ea498b6c` with its pre-existing challengeService.ts and matchService.ts modifications and untracked Loop 3 sport-ratings migration; no original-checkout file was edited.

Complete Header diff review confirmed native inset-based placement and full-width title space without a device-specific cutout offset. The existing native content dimensions are separate from the reported inset. The absolute title is positioned from the header origin, while the normal-flow controls use container padding; these do not add the inset twice to the same content. App.tsx supplies SafeAreaProvider rather than an extra padded header wrapper, and RootNavigator uses the custom header with the parent Tabs header hidden. No new double-inset path was found. Logo dimensions/horizontal placement, Home title typography, web values, navigation handlers and screen/card spacing remain unchanged. No additional source edits were made for this checkpoint.

The report retains the prior iPhone 17 Pro / iOS 26.4 evidence for all eight requested native screens, Home branding and representative web regressions. Header status remains **RESOLVED LOCALLY — NOT DEPLOYED**. Overall classification remains **LOOP 4.2F-1 PARTIAL — VERIFICATION GAPS REMAIN**. No native environment or broad backend suite was rebuilt for this checkpoint. The only permitted commit files are `src/components/ui/Header.tsx` and `docs/loop-04-2f-1-qa.md`, with subject `Loop 4.2F-1: fix native header safe-area layout`.


Checkpoint validation: `npm run typecheck` and `git diff --check` passed again. The temporary matching dependency copy was removed afterward. Scope review confirms only Header source and this report differ; no backend, configuration, package, lockfile or native-project changes. Report review and focused scanning found no credentials, tokens, fixture passwords or literal disposable endpoint/stack values. The prior visual evidence is retained without new visual-test claims. The local checkpoint does not change any remaining DEFERRED coverage or authorize deployment, push, merge or 4.2F-2.


## Final remaining-gaps QA pass — 2026-10-05

**LOOP 4.2F-1 BLOCKED — DEFECT FOUND.** This targeted pass stopped after reproducing the product defect below, as explicitly required. Unfinished functional scenarios remain gaps; no COMPLETE claim is made. Historical suites were not rerun and their prior results are not new evidence.

### Preflight and isolation

Authorized worktree and branch matched the request, with clean worktree, empty index, and HEAD `0a7d1d90b41fae1c2153812bc200c0bf31681c28`. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. A fresh disposable local Supabase stack used copied migrations/functions and disposable reference prerequisites, four synthetic profiles, and an incoming friend request. The Expo launcher verified the authorized worktree and loopback backend, disabled dotenv loading, and injected configuration only into its process. The dependency copy matched the frozen worktree's lockfile. No production mutation, package upgrade, native build, or source modification occurred.

### Remaining-gap evidence matrix

| Requested gap / surface | Outcome, evidence and classification |
| --- | --- |
| Web confirmation dialogs | **TOOL LIMITATION.** Block exposed the expected browser confirmation text. The documented dialog getter returned no usable dialog; subsequent tab inspection timed out on browser focus emulation. A local state read showed one block row, but explicit Cancel/Confirm selection was not observed and is not claimed. Recovery required closing the task tab and opening a fresh one. Unblock/Remove Friend were not retried before the product-defect stop. Historical component/native evidence remains historical; web Cancel/Confirm and rapid-repeat coverage remain unverified. |
| Live Block → request/badge | **TOOL LIMITATION; functional gap remains.** Before Block, Home displayed Inbox attention count 1; Inbox showed the sender with named Accept/Decline actions; its Opponent Profile exposed Accept Friend Request/Decline/Block. The browser primitive interrupted inspection after Block. A fresh tab subsequently showed no incoming request and no attention count, but this is a reload boundary, not proof of immediate/focus lifecycle invalidation. No claim that the live badge gap passed, and no stale-badge product defect established. |
| Actual Nearby UI | **VERIFIED LOCALLY — web.** Generic composer → Choose Nearby Player displayed eligible C and D with correct identities, pickleball/intermediate, ready-now state and local distance. View Profile on C opened C's identity, sport, record and social controls; Back returned to Nearby. A was blocking B before discovery, so B was absent. A controlled reverse block D→A was then established. Changing the visible timing filter triggered a fresh query showing only C: both blocked directions and A's own identity were absent. This verifies fresh-query filtering, not realtime removal from an already loaded list. |
| Self-profile routing | **VERIFIED LOCALLY, limited boundary; full gap remains.** Owner Profile displayed the signed-in synthetic username and owner controls, without Add Friend/Block/Rematch-to-self actions. Nearby excluded self. No complete legitimate self-selection route or architectural route audit was completed before the defect stop. This is not a full self-routing pass. |
| Generic challenge create/decline/cancel | **VERIFIED LOCALLY for create and decline; cancel gap remains.** From the generic composer via Nearby, A selected ordinary unblocked C. Composer locked the correct username, pickleball/Singles and chosen timing. UI creation produced a pending sent row with Cancel Challenge. C's Inbox displayed A's pending challenge with Accept/Decline. Decline disabled both actions during the request and removed the row afterward. Returning as A showed no active pending row. C's Profile showed zero W/L/D, matches and XP; local reads confirmed the direct challenge was declined, no matches existed and all four synthetic profiles retained zero W/L/D/matches/XP. Separate ordinary direct-challenge cancellation was not executed before the stop. The open-challenge cancellation used below is setup, not a substitute for this gap. |
| Stale Quick Match Join | **PRODUCT DEFECT — P2, moderate UI/state-recovery defect.** C created an open challenge through UI. A displayed that challenge with Join Game. C then canceled it through the authenticated local creator endpoint while A stayed on the displayed row. A clicked Join; the button disabled during submission, then returned enabled with “This open challenge is no longer available.” The canceled row remained visible and actionable. A second click reproduced the same error with the same enabled row. No false-success navigation occurred. Local reads confirmed canceled/open state with no opponent assignment, zero matches, and unchanged zero progression. Backend protection passed; stale-row recovery failed. Blocked-pair stale Join was not attempted after the defect. |
| Draw UI | **DEFERRED RELEASE COVERAGE — material functional verification gap.** Not reached before the required product-defect stop. Historical backend draw evidence is not a new UI pass. Submission, opposing confirmation, W/L/D, XP, rating, history and rivalry remain unverified through this pass's UI. |
| Dispute/reject UI | **DEFERRED RELEASE COVERAGE — material functional verification gap.** Not reached before the required stop; intended/unauthorized participant UI and no-premature-progression checks remain open. Historical backend evidence is preserved without reclassification. |
| Native scrolling | **TOOL LIMITATION; unverified.** Existing iPhone 17 Pro / iOS 26.4 window and Expo dev menu were readable, but coordinate activation of the visible Reload control failed twice with no window available, including after reacquiring the simulator and taking a fresh screenshot. The app could not be brought onto the fresh fixture session through that approach before the defect stop. No new native scrolling, keyboard or bottom-reachability pass is claimed on Home, Inbox, Profile, Opponent Profile, Friends, Blocked Players or composer. Prior header evidence remains historical. |
| Practical accessibility | **VERIFIED LOCALLY in limited web samples; remaining coverage deferred.** Request actions had meaningful sender-specific labels and button roles; challenge creation, decline and Join exposed disabled state while busy. The stale Join error was readable, and its screenshot showed a clear header and unclipped visible card/button. A Return-key activation attempt did not establish a distinct observable activation and is not counted as keyboard-operation success. Dialog controls, broader focus/keyboard/touch checks were not completed. VoiceOver and second-device native coverage remain **DEFERRED RELEASE COVERAGE**, not product defects. |

### Reproduction and likely source

1. Sign into controlled local creator C and use Home → Post Open Challenge to create a pending open pickleball challenge.
2. Sign into eligible A and open Home → Play Now; verify C's row and Join Game are visible.
3. Without navigating or reloading A, cancel that challenge as C through the authenticated local creator endpoint; cancellation succeeds.
4. Click A's still-visible Join Game. Observe the unavailable error and the canceled row retained with Join Game enabled.
5. Click Join Game again. The same error and actionable stale row remain. Backend state still has no opponent assignment or match.

Expected: after definitive rejection because the challenge is no longer available, refresh or remove the stale row so it is no longer presented as joinable. Actual: error text updates but stale list data remains, enabling repeated invalid retries. Severity is P2/moderate: confusing and recoverable discovery state, with no observed authorization bypass, false acceptance or progression corruption.

Likely source is `src/modules/discovery/presentation/NearbyPlayersScreen.tsx`, `handleJoinOpenChallenge` (lines 245–262 at this HEAD). Success filters the row out; the catch branch only sets `actionError`, and finally clears the busy id. It does not remove/refetch the stale row or increment `reloadKey` on definitive unavailability. This is source analysis supporting the UI reproduction, not an implemented fix. No source edits were made. Further functional QA stopped here under the founder's policy.

### Validation and checkpoint policy

`npm run typecheck` passed. Initial `git diff --check` passed; final report diff validation is recorded after cleanup below. No broad backend suite was rerun. This pass changes only this report, intentionally unstaged. No staging, commit, push or merge is authorized/performed; HEAD remains the starting checkpoint.

Cleanup completed: exact task-created Expo/function processes stopped; disposable stack/data removed without backup; only the pre-existing baseline stack remains running; task web listener absent. Temporary dependencies, fixtures, credentials, scripts and logs were removed. Task browser tabs were closed and the task-opened simulator dev menu dismissed. No pre-existing service was stopped.

Final repository checks: `git diff --check` passed; only `docs/loop-04-2f-1-qa.md` is modified and unstaged; index empty; HEAD unchanged at `0a7d1d90b41fae1c2153812bc200c0bf31681c28`. Frozen Loop 3 remains clean at `53fc064d361b565aa793b7929b18379ae4607970`. Original checkout retains its pre-existing two service modifications and untracked migration at its unchanged HEAD; it was not modified or cleaned. No commit created. Report contains no credentials, tokens, fixture passwords or disposable endpoint/port values.

PRODUCTION DATABASE MODIFIED: NO

PRODUCTION FUNCTIONS DEPLOYED: NO

PRODUCTION DATA MODIFIED: NO

PUSH PERFORMED: NO

MERGE PERFORMED: NO

4.2F-2 STARTED: NO

Stopped for founder review. No substantial defect implementation or additional phase started.


## Authorized stale Quick Match Join correction — 2026-10-06

**STALE QUICK MATCH JOIN DEFECT: RESOLVED LOCALLY — NOT DEPLOYED.** Overall classification returns to **LOOP 4.2F-1 PARTIAL — VERIFICATION GAPS REMAIN**. The prior P2 reproduction and remaining-gaps evidence are preserved above. No remaining unrelated QA was automatically resumed.

### Preflight, trace and root cause

Preflight matched the authorized worktree and `codex/loop-04-social-community`, HEAD `0a7d1d90b41fae1c2153812bc200c0bf31681c28`, with only this existing report modified and an empty index. Frozen Loop 3 was clean at its expected HEAD. Existing QA evidence was preserved.

`NearbyPlayersContent` in `src/modules/discovery/presentation/NearbyPlayersScreen.tsx` owns the Quick Match rows. Home → Play Now selects its play-now mode. `renderOpenChallenge` invokes `handleJoinOpenChallenge`, which calls `acceptLoopTwoOpenChallenge` → `invokeLoopTwoChallengeFunction` → `accept-open-challenge`. Success removes the row and resets navigation to Inbox in the full app; the Loop 2 wrapper navigates to Match Inbox. Failure previously only set `actionError`, then cleared `joiningChallengeId`, leaving stale rows enabled. The existing list-load effect was driven by user/filter dependencies and `reloadKey`, with effect-local read cleanup; it did not refresh on Join rejection or focus, and Join continuations had no lifetime guard or synchronous duplicate lock.

The endpoint verifies the bearer session and resolves the caller's canonical onboarded profile. Missing/nonpending/nonopen targets and blocked pairs return HTTP 409 with the same safe unavailable message. The service turns non-success responses into an Error containing the message, without retaining a structured HTTP status. `social_accept_challenge` resolves the trusted authenticated actor, rejects self/wrong-recipient/already-assigned cases, checks mutual blocking under the pair transaction lock, and conditionally updates only the still-pending eligible row. Only the service role can execute that RPC. Review of the existing block-enforcement suite confirmed both blocked directions and an unrelated successful Join are covered historically. No backend semantics, authorization, discovery filters or progression rules changed; that broad suite was not rerun.

### Exact client correction and ordering review

Only the Nearby screen changes in application source. On an active Join failure, it preserves safe feedback, immediately invalidates that request lifetime, hides actionable rows behind loading, and increments the existing `reloadKey` once. The existing authoritative loader determines the new list. This is not optimistic deletion of a particular row and does not retry the mutation. A transient/ambiguous failure can therefore retain a row if the refreshed server response still permits it. A refresh failure clears rows and exposes the existing Try Again state, with no success/navigation claim and no automatic refresh loop. Since the service does not retain status, one bounded reconciliation follows any actual Join failure; no special cases depend on error-message text.

A synchronous lifetime-owned Join lock rejects duplicate activation before React rerenders. Account, filter, focus and reload changes establish a new request scope. Layout cleanup invalidates old completions before the next committed screen can act; read callbacks additionally retain the existing effect-local cancellation check. An old Join success cannot navigate a new account/screen, and an old Join failure cannot overwrite feedback or start a refresh in a new lifetime. Old reads cannot replace newer data. Blur invalidates the old lifetime, and refocus obtains a fresh authoritative list. Busy state resets for the new lifetime; rows remain hidden/non-actionable until its read completes. Unmount invalidates pending actions. The hydration early return was moved below the hooks so profile loss/recovery cannot change hook order. This stays within the screen rather than introducing a generic state-management layer.

### Focused regression evidence

A temporary React 19.1 renderer harness outside the repository mounted the actual transpiled screen, mocked its service/navigation/native presentation boundaries, and used controlled deferred promises. No production calls or replacement implementation were used. The same final 14-scenario harness was run against the unchanged HEAD source and the correction: **before: 2 passed / 12 failed; after: 14 passed / 0 failed**. The core before-fix failure observed only the initial list request rather than the required second authoritative read. Duplicate synchronous activation also reached the service twice before the fix. The unchanged successful Join and older-read/account-change cases were the two before-fix passes.

Passing scenarios: canceled, already-joined, blocked and no-longer-open rejections; synchronous duplicate protection with busy state through a delayed refresh; ordinary success and one navigation; refresh failure with no stale Join and manual retry recovery; transient failure with an authoritatively retained row; old Join rejection after account change; old Join success after account change; older list read after a newer account read; older rejection-refresh after blur/refocus; late completion after unmount; and profile hydration/loss with stable hook order. Equivalent stale-category renderer cases simulate service outcomes; the distinct canceled/taken/blocked backend conditions were additionally exercised through authenticated UI below. The harness and renderer dependencies are temporary and removed after validation, following the existing component-testing approach. No repository package/lockfile changes or new test infrastructure are included.

### Authenticated visual verification and security

A fresh disposable local Supabase stack, copied migrations/functions and synthetic users supplied the fixtures. Expo's launcher verified the authorized worktree and loopback backend, disabled dotenv loading, and provided process-only configuration. A temporary real dependency copy matched the frozen worktree's lockfile. Initial browser navigation preceded server readiness; a fresh task tab worked once the server was running. No production backend was used.

| Scenario | New observed result |
| --- | --- |
| Canceled stale Join | A displayed B's pending open challenge. B canceled it through its authenticated local endpoint while A remained on that row. A pressed Join: the unavailable error remained visible, the authoritative refresh produced the empty Quick Match state, and no Join control remained. No reload/restart was required. A screenshot and accessibility state captured the error plus empty list. Local reads confirmed canceled state, no opponent assignment, zero matches and zero progression before subsequent fixtures. |
| Already-taken stale Join | A displayed a separate pending challenge. Synthetic C accepted it while A stayed on the displayed list. A's Join safely rejected, preserved the unavailable message and removed the row after refresh. Local verification confirmed the assignment remained C's with exactly one legitimate match for that challenge; A did not replace C. |
| Blocked-pair stale Join | A displayed another pending open challenge. Creator B blocked A through the authenticated local social endpoint. A's stale Join rejected and the refreshed list removed the row with safe feedback. At that point the challenge remained pending/unassigned with no match. This setup does not close the separate live friend-request/badge gap. |
| Ordinary successful Join | The synthetic pair was restored and a separate eligible challenge prepared. A pressed Join through UI and navigated to Inbox showing the intended challenge as accepted. Local reads confirmed A was its opponent and exactly one match existed for this challenge. Across the complete fixture set, the only two matches were C's legitimate taken-case match and A's successful regression match. W/L/D, matches-played statistics and XP remained zero for all synthetic profiles, as no result was finalized. |

These observations resolve the original client reconciliation defect without weakening backend protections. No substantial additional product defect was identified. Native scrolling, other social flows and result UI were not part of this correction pass.

### Validation, scope and remaining gaps

`npm run typecheck` passed and `git diff --check` passed. Complete source diff review found only the targeted screen correction. The report diff retains the prior pass plus this correction and updates the current outcome. No migrations, database/RLS/auth code, production configuration, packages/lockfiles, native projects, unrelated friendship UI or progression code changed. Historical backend and component suites remain historical; only the 14 focused renderer cases and the scoped authenticated UI scenarios above were newly executed.

Remaining Loop 4.2F-1 gaps: live Block/request/badge refresh without reload; remaining web confirmation Cancel/Confirm evidence and its tool limitation; complete self-routing evidence; direct challenge cancellation; draw UI; dispute/reject UI; native scrolling; remaining accessibility coverage, including deferred VoiceOver and second-device release coverage. No COMPLETE claim is made.

The founder authorized exactly one local checkpoint after these checks: `Loop 4.2F-1: reconcile stale Quick Match joins`. The only intended commit files are `src/modules/discovery/presentation/NearbyPlayersScreen.tsx` and `docs/loop-04-2f-1-qa.md`. Cleanup and staged review follow before committing. No push, merge, deployment or 4.2F-2 is authorized.


Correction cleanup verified: exact task-created Expo/function processes stopped, disposable stack/data removed without backup, temporary dependency copy/renderer/harness/scripts/fixtures/credentials/logs removed, and task web listener absent. Only the pre-existing baseline Docker stack remains. The working QA browser tab was closed. The initial failed-load error tab could not be reacquired because the browser tool blocks its generated data URL; it was left unmarked for automatic temporary-tab cleanup. This did not affect the successful UI tests.

Pre-checkpoint scope remains exactly the two intended files. The final report contains no credentials, tokens, fixture passwords or disposable endpoint/port values. Frozen Loop 3 remains clean at `53fc064d361b565aa793b7929b18379ae4607970`; the original checkout retains its unchanged pre-existing modifications and untracked migration. No files in either checkout were edited. Static validation and complete diff review passed; the local checkpoint is authorized. This checkpoint supersedes the preceding verification pass's no-commit policy only for the intended screen/report correction.

PRODUCTION DATABASE MODIFIED: NO

PRODUCTION FUNCTIONS DEPLOYED: NO

PRODUCTION DATA MODIFIED: NO

PUSH PERFORMED: NO

MERGE PERFORMED: NO

4.2F-2 STARTED: NO

Stop after the local checkpoint for founder review; do not automatically continue the remaining gaps.

## Closure QA — remaining functional gaps (2026-10-07)

**LOOP 4.2F-1 PARTIAL — VERIFICATION GAPS REMAIN.** No new material product defect was reproduced. Native scrolling remains a material verification gap; this pass does not claim completion. Previous sections remain historical evidence, not newly rerun tests.

### Scope and preflight

Authorized Loop 4 worktree was on `codex/loop-04-social-community`, clean with an empty index at `d704cba13ec93e0935d48adaa22a340e0d33e46d`. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. All mutations used synthetic accounts in a separate disposable local Supabase stack. The process-only Expo launcher checked the exact local target and disabled dotenv loading; no production configuration was changed. Existing baseline services were preserved. No application source, package versions, lockfiles or native project files were changed.

### Remaining-gap results

| Item | Surface and evidence | Result / classification |
| --- | --- | --- |
| Live Block → request / badge | Native A had one incoming B request and a visible Inbox badge 1. A opened B from the request and confirmed Block in the supported native dialog. B became unavailable. Returning to Inbox showed Incoming (0), no request and no Accept/Decline. Returning Home showed no Inbox badge; another Inbox visit did not restore the request. The local relationship row was terminated (`removed`, ended timestamp set). No app restart, full reload or manual Inbox refresh occurred during the transition. | **VERIFIED LOCALLY.** First visible return/focus showed reconciled request and badge state. Social invalidation is emitted by the mutation; this observation does not distinguish an offscreen immediate badge update from its focus refresh. |
| Web Block / Unblock / Remove Friend | Attempted all three on populated synthetic relationships. Each emitted the expected named-player confirmation and consequence text. The documented dialog getter returned no active handle. Remove Friend was followed by a focus-emulation timeout; fresh tabs restored access. No explicit Cancel/Confirm selection is claimed, and later state changes are not proof of selection or mutation count. Reviewed all three `window.confirm` branches: false returns without mutation; true invokes the existing guarded operation. Prior native confirmation and component cancellation/lifecycle evidence remains established. | **TOOL LIMITATION — NON-BLOCKING.** No evidence establishes a broken product dialog. No dialog redesign or automation bypass was introduced. |
| Self-profile boundary | Exact signed-in username search returned “No player found.” Home discovery exposed only other eligible players; owner Profile displayed owner controls. Route audit found opponent entry points through search/Nearby, friendship/request identities and match counterparts, rather than an owner-selection UI. Search and Nearby explicitly exclude the caller; canonical friendship pairs cannot contain self. `OpponentProfileScreen` replaces a known-self route with Tabs/Profile before fetching the opponent or relationship; its initial loading state exposes no opponent actions, and Block additionally guards self. Existing self/backend cases remain historical support. | **VERIFIED AT REACHABLE PRODUCT BOUNDARY.** Known-ID route safety is code-review evidence, not an invented visual route or a newly executed component test. No Add Friend, Block, Challenge or Rematch-to-self control was exposed by the reachable owner/search surfaces. |
| Direct cancellation | A canceled a pending direct challenge through the native sender Inbox and confirmed its native alert. Sender Inbox emptied. C's already-open web row remained temporarily stale; attempting Accept returned “This challenge is no longer pending,” removed Accept/Decline and offered Try Again. Try Again produced an empty Inbox. Local state was canceled with no match for that challenge. Later focused invariants established only the separate draw match produced XP; no rating rows existed. | **VERIFIED LOCALLY.** Stale recipient acceptance failed safely; no match/result, XP, W/L/D or rating contribution arose from cancellation. No real-time removal claim is made for the already-open recipient screen. |
| Draw result | A selected Draw and submitted through the native Record Result screen. C saw Proposed result: Draw and confirmed through web “Confirm Draw & Update Stats.” Final UI said Draw, +150 XP, 0 wins, 0 losses, 1 draw, 1 played. Database totals matched for both players; winner was null, result confirmed, exactly two XP entries belonged to this draw and rating tables were empty. Both owner profiles exposed Confirmed result · Draw and record versus opponent 0-0-1; Home/rematch text said “You drew last time.” Native lower history was observed in the accessibility tree, not established as visually scroll-reachable. | **VERIFIED LOCALLY.** Existing draw reward/rating rules preserved; no false win in history/rivalry. |
| Dispute / reject | A submitted a separate proposed win through native UI. C used the actual web “Dispute Result” action. UI stated Result rejected, result now disputed, no longer ready for confirmation, and explained coordination/refresh. Database status was disputed rather than confirmed. Both players retained 0/0/1, one match and 150 XP from the earlier draw; XP entries remained draw-only and rating tables empty. Home/rivalry continued to describe the draw and owner history remained 0-0-1. | **VERIFIED LOCALLY.** Product button terminology is Dispute Result; resulting presentation says Result rejected. Prior nonparticipant rejection and rejection-of-confirmation tests remain historical evidence; they were not broadly rerun. |
| Native scrolling | iPhone 17 Pro simulator accepted taps and displayed the corrected header. Profile was genuinely longer than its viewport. Coordinate scroll and drag produced no visible vertical movement. Earlier Opponent Profile scroll attempts likewise did not establish movement; a drag acted like a tap and opened the composer. These inputs cannot reliably distinguish simulator input delivery from application scrolling. A manual swipe check was requested but no result was available for this report. | **MATERIAL VERIFICATION GAP.** Not classified as a product defect from failed automation alone. Long Inbox, populated Friends/Blocked Players, Opponent Profile and keyboard/composer lower-control reachability are not claimed as passed. “NATIVE SCROLLING — VERIFIED ON TESTED DEVICE” cannot be assigned. |

### Practical accessibility review

Representative web confirmation/result actions retained meaningful accessible button names and exposed disabled state while pending, including Confirm Draw & Update Stats and Dispute Result. Native cancellation and Block dialogs exposed understandable title, consequences and choices; their tap actions worked. Username input and Tab keyboard traversal worked on web. The visible native Profile header stayed below the status area, and visible body labels were readable. Historical unnamed back controls and inconsistent native AX role representation remain coverage limitations; this is not a full role or screen-reader audit. Lower content, comprehensive touch reachability and keyboard-safe form actions remain tied to the native scrolling gap. VoiceOver and a second native device remain **DEFERRED — RELEASE QA COVERAGE LIMITATION**; those alone do not block completion.

### Validation and disposition

`npm run typecheck` passed. No new material product defect was reproduced and no fixes were implemented. The report is the only intended tracked change and remains unstaged; no commit or staging is authorized for this pass. Expected HEAD remains `d704cba13ec93e0935d48adaa22a340e0d33e46d`. Final `git diff --check` passed; cleanup is recorded below.

PRODUCTION DATABASE MODIFIED: NO. PRODUCTION FUNCTIONS DEPLOYED: NO. PRODUCTION DATA MODIFIED: NO. PUSH PERFORMED: NO. MERGE PERFORMED: NO. 4.2F-2 STARTED: NO.

### Closure-pass cleanup and final repository state

Stopped the task-owned Expo and function servers and removed the disposable Supabase stack/data without backup. Removed the task-only dependency copy and temporary fixtures, credentials, scripts and logs. Closed all three closure-pass QA browser tabs. The QA listener and task processes were absent afterward; only the pre-existing baseline Docker stack remained. No original-checkout cleanup was performed.

Loop 4 retains the expected HEAD and an empty index; only this report is modified and unstaged. Frozen Loop 3 remains clean at its expected HEAD. The original checkout retains its pre-existing changes and was not modified by this task. No commit, push, merge, deployment or Loop 4.2F-2 work was performed.

## Final native usability check and closure decision (2026-10-07–08)

**LOOP 4.2F-1 PARTIAL — VERIFICATION GAPS REMAIN.** The remaining native uncertainty is material: keyboard dismissal alone does not establish that users can reach every required field and submission control. It is not reduced to a non-blocking release-coverage note, and no unobserved functionality is marked verified.

### Preflight and environment

Rechecked the authorized worktree and branch at `d704cba13ec93e0935d48adaa22a340e0d33e46d`: only this pre-existing unstaged report was modified; index empty. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. The existing iPhone 17 Pro simulator ran iOS 26.4. The previously loaded app retained the prior synthetic local QA session. Its disposable Supabase backend had already been removed during the preceding pass; this diagnostic used retained UI only, did not submit a challenge or create data, and did not switch to production. No fresh populated backend test run is claimed. A later network-failure development warning is consistent with that stopped local environment, not a diagnosed production defect.

### Observations and minimal diagnostics

- Profile initially displayed its bottom history, rivalry record, Challenge Again and Log Out controls. Header and bottom navigation remained correctly positioned and these lower controls were visibly inside the screen. The gesture that reached that initial position was not observed, so this is evidence of the displayed lower layout, not a witnessed gesture-scroll pass.
- Coordinate scroll upward on Profile produced no visible movement. A drag also produced no vertical content movement. Semantic taps continued to work and opened Create Challenge.
- On Create Challenge, activating the offscreen location field through accessibility brought its section into view. This demonstrates focus-driven repositioning, not touch-gesture scrolling. The simulator initially hid the software keyboard; toggling it visible exposed the iOS keyboard. The keyboard covered lower form content, including the focused location field in that snapshot. Return dismissed it and restored the visible location field.
- Activating the lower note field through accessibility brought another part of the form into view and displayed the keyboard, but did not establish that the focused note or Send Challenge was reachable above it. Scrolling above the keyboard caused no visible movement. On resumption, a drag from the visible form area dismissed the keyboard without moving the content, behaving like a tap rather than a swipe. No repeatable gesture-scroll pass resulted.
- These observations identify an **unresolved simulator input/tool limitation**, not proof that application scrolling is broken. Keyboard overlap is recorded as an observation; without reliable scrolling it does not establish permanent obstruction or a material product defect. No substantial fix was made.

### Coverage and disposition

| Screen / requirement | Final evidence |
| --- | --- |
| Profile | Lower layout visually observed; gesture response still unverified. |
| Create Challenge | Focus-driven repositioning and keyboard dismissal observed; gesture scrolling, full keyboard reachability and bottom submission-control reachability remain unverified. |
| Long Inbox | No new populated scrolling pass; remains unverified. |
| Populated Friends | No new populated scrolling pass; remains unverified. |
| Populated Blocked Players | No new populated scrolling pass; remains unverified. |
| Opponent Profile | Earlier unsuccessful gesture attempts remain historical; no new scrolling pass. |

The requested manual swipe check had no returned result at report time. Native scrolling cannot be labeled VERIFIED ON TESTED DEVICE. VoiceOver and second-device testing remain **DEFERRED — RELEASE QA COVERAGE LIMITATION**. Web confirmation automation limitations remain non-blocking on the established native/component evidence. All previous functional/backend/web evidence is preserved and was not rerun.

`npm run typecheck` passed using a temporary real copy of the existing matching-lockfile dependencies; no versions or lockfiles changed. `git diff --check` passed. Only this report is changed and remains unstaged; no source edits, staging or commit. Temporary validation dependencies were removed after validation. Restored the prior software-keyboard visibility setting and used the header Back control to leave the unsent form successfully; no submission occurred. No new QA servers, backend stack, fixtures or credentials were created for this diagnostic.

PRODUCTION DATABASE MODIFIED: NO. PRODUCTION FUNCTIONS DEPLOYED: NO. PRODUCTION DATA MODIFIED: NO. PUSH PERFORMED: NO. MERGE PERFORMED: NO. 4.2F-2 STARTED: NO.

## Founder manual native results and additional defect (2026-10-10)

Testing performed **MANUALLY BY FOUNDER**, using the prepared isolated local synthetic environment on iPhone 17 Pro / iOS 26.4. Founder explicitly confirmed testing finished. Codex did not perform or claim the manual gestures. Earlier automated limitations remain historical evidence.

| Manual test | Founder result |
| --- | --- |
| A1 Inbox | PASS |
| A2 Profile | PASS |
| A3 Friends | PASS |
| A4 Blocked Players | PASS |
| A5 Opponent Profile | PASS |
| B1 Create Challenge | PASS |
| B2 Find Player | PASS |

These results resolve the previously unverified named native scrolling and keyboard checks. They do not cover every native screen: the founder separately reported “scrolling issue on choose nearby player. list of nearby players is cut off”.

### Additional product defect — Choose Nearby Player list clipping

**Classification: PRODUCT DEFECT, founder-reported with current-screen visual corroboration. Severity: P2 (native layout/scroll usability); players remain reachable, so this is not a complete player-selection blocker.** Overall status is **LOOP 4.2F-1 BLOCKED — DEFECT FOUND**. No closure commit is warranted while this issue is unresolved.

Affected path: Create Challenge → Choose Nearby Player → Nearby Players. This is the product route corresponding to the reported control; the founder's exact preceding steps remain unconfirmed. On a populated nearby list, inspect/scroll the player cards. Expected: a usable list viewport with complete cards and reachable selection controls. Actual founder report: list is cut off and scrolling has an issue. Read-only inspection of the screen left open by the founder showed the filter panel occupying most of the body, only the upper part of the first player card visible, and a large blank area below its clipped boundary. The accessibility tree included additional loaded player records; their presence does not prove visual reachability. Codex performed no automated scroll replay.

Founder clarification: “they are reachable but clipped. the page does not scroll from the top”. This establishes that player reachability is retained while the outer-page/filter-area scroll behavior and clipped list viewport remain defective. Do not describe players as unreachable or claim permanent keyboard obstruction. Exact preceding navigation steps and root cause were not independently reproduced; no automated gesture replay was performed.

Likely source area for a separately authorized correction: `src/modules/discovery/presentation/NearbyPlayersScreen.tsx`, where a non-scrollable Screen contains a filter Card above a separate FlatList, together with the shared MainLayout sizing/padding. This is an investigation lead only; no causal diagnosis or source modification is claimed.

VoiceOver, second-device coverage and web confirmation automation remain the previously documented release limitations; web confirmation has existing native/component support. No full accessibility compliance or production QA pass is claimed.

No closure commit, source edit, push, merge, deployment or Loop 4.2F-2 work. The report remains unstaged and preserves all preceding evidence. `npm run typecheck` and `git diff --check` passed. Task-created Expo/function services and the disposable Supabase stack/data were stopped; temporary dependencies, fixtures, credentials and scripts were removed after the founder confirmed testing finished. The task listener/processes are absent and the pre-existing baseline stack was preserved. Loop 4 retains its expected HEAD and empty index, with only this report modified. Frozen Loop 3 remains clean at its expected HEAD. The original checkout retains its unrelated pre-existing changes and was not modified.

PRODUCTION DATABASE MODIFIED: NO. PRODUCTION FUNCTIONS DEPLOYED: NO. PRODUCTION DATA MODIFIED: NO. PUSH PERFORMED: NO. MERGE PERFORMED: NO. 4.2F-2 STARTED: NO.

## P2 Nearby Players native scrolling correction (2026-10-10)

**FIX IMPLEMENTED — AWAITING FOUNDER NATIVE VERIFICATION.** Overall status remains **LOOP 4.2F-1 BLOCKED — DEFECT FOUND** until actual native behavior is confirmed. The seven original founder manual passes remain valid historical evidence; they are not a verification of this new correction.

### Preflight and reproduction

Authorized branch/worktree and HEAD `d704cba13ec93e0935d48adaa22a340e0d33e46d` matched; only the existing QA report was modified and the index was empty. Frozen Loop 3 was clean at `53fc064d361b565aa793b7929b18379ae4607970`. A new disposable local stack and synthetic primary plus sixteen player accounts were created. One player was blocked through the supported local social transition. No production data was used. The process-only Expo launcher disables dotenv and asserts the local backend; the actual served iOS bundle contained the intended local target and no production project reference. Temporary dependency versions match the existing lockfile; no dependency or native-project changes.

On unchanged source, Create → Choose Nearby Player reproduced the founder's screenshot on iPhone 17 Pro / iOS 26.4: the large Local Matchmaking/filter card filled nearly the entire body, with only the upper strip of the first player card visible before the list viewport ended. A blank lower clearance area followed. The top navigation header was not overlapping the card. Multiple players were loaded; presence in the accessibility tree did not establish full visual reachability. The founder had already confirmed rows were reachable but clipped and scrolling from the top did not work. No unreliable automated gesture sequence was counted as reproduction of gesture behavior.

### Confirmed layout cause and source correction

`NearbyPlayersScreen` rendered a non-scrollable Screen containing a flex column, with the large filter Card as a fixed sibling above FlatList. On the tested native viewport, wrapping title/filter content consumed most of the column height. FlatList consequently received only the remaining narrow viewport; gestures on the filter panel could not scroll that panel away. Shared MainLayout reserves safe-area and bottom clearance, reducing available height further, but the correction does not change that shared behavior. This is a constrained sibling-list layout, not nested ScrollViews, keyboard interference, or a missing flex on the screen's parent. The route is a stack screen rather than a bottom-tab content screen; existing bottom clearance was preserved.

Only `src/modules/discovery/presentation/NearbyPlayersScreen.tsx` changes: native non-Quick-Match Nearby now uses one flexing FlatList, with the existing filter Card in ListHeaderComponent and existing loading/error/empty content in ListEmptyComponent. All players use the unchanged renderPlayer function and existing card spacing/content styles. Filters and player rows can therefore share the full available scrolling viewport rather than compete for its fixed height. Web and Quick Match retain their original sibling-filter/list path. Filter and state JSX was extracted into local values for reuse without redesign. No header, shared layout, tab bar, player card, composer, service, backend or lifecycle/Join handler changes.

Reviewed the preceding stale Quick Match correction: its request lifetime, stale-read suppression, duplicate Join guard, failed-Join authoritative reload and fail-closed refresh handling are untouched.

### Focused regression evidence

A temporary React 19.1 renderer harness outside the repository loads the actual transpiled screen with mocked services/navigation/native primitives. These are component checks, not native pixel/gesture evidence. The final same nine checks against unchanged source yielded **7 passed / 2 failed** (native shared-list header and shared loading viewport); corrected source yielded **9 passed / 0 failed**. Harness bootstrap issues were repaired before this comparison and are not counted as product failures. Passing checks cover:

- Native filters and all fifteen rows sharing the sole flexing list under the non-scrollable Screen.
- First/last row identity, profile navigation and challenge navigation callbacks.
- Loading retaining filters without stale player rows.
- Empty-state Find Player navigation.
- Error/Retry recovering authoritative player data.
- Availability changes being forwarded to the loader and refreshing rows.
- Original web sibling/filter structure; serialized populated web component output is byte-identical before/after.
- Failed stale Quick Match Join invoking one authoritative reload and removing the stale action, separately on native and web.

Authenticated local Nearby response returned all fifteen eligible players and excluded both the explicitly blocked sixteenth player and self. No broad backend suite was rerun. In the actual web app, Create → Choose Nearby Player populated correctly; scrolling loaded player 15 and its View Profile opened the correct opponent. This establishes focused web functionality plus unchanged component structure, not exhaustive small-viewport web QA. The original native constrained-list symptom was visually reproduced; an equivalent complete first/last-card failure was not established on web.

`npm run typecheck` and `git diff --check` passed. Reviewed exact source diff; source matches the tested correction. No unintended tracked files or index changes.

### Native verification handoff

Corrected app is loaded on the existing iPhone 17 Pro simulator, signed into the synthetic account and left on Nearby Players with fifteen eligible players. Header/filter rendering is observed, but no native gesture pass, fully visible first/last card or bottom-clearance pass is claimed from code/component output. Founder must confirm:

1. Swipe starting over the top/filter area; scroll to the bottom and back to the top.
2. Bring player 01 fully into view, including its actions.
3. Reach and fully view player 15 and its actions.
4. Confirm the last card is not obscured by the screen edge/navigation; the header remains positioned correctly.
5. Open a player's profile and return successfully.

Simulator, Metro, local functions, disposable backend and temporary dependencies remain running/present for this check. The completed temporary web tab was closed. Do not clean up or commit before the founder responds. If verified, run final checks and create only the specifically authorized local Nearby-fix commit. If it fails, leave changes unstaged and report the remaining defect.

Remaining release limitations: VoiceOver and second-device coverage deferred; web confirmation automation limited with established native/component evidence. These do not replace the required native confirmation for this defect. No full accessibility compliance or production QA/deployment claim.

PRODUCTION DATABASE MODIFIED: NO. PRODUCTION FUNCTIONS DEPLOYED: NO. PRODUCTION DATA MODIFIED: NO. PUSH PERFORMED: NO. MERGE PERFORMED: NO. 4.2F-2 STARTED: NO.


## Automated native verification follow-up (2026-10-10)

**NATIVE VERIFICATION INCONCLUSIVE — SIMULATOR INTERACTION LIMITATION.** Preserve overall **LOOP 4.2F-1 BLOCKED — DEFECT FOUND**, referring to the previously reported P2 defect whose correction awaits verification. No new product defect was established by this attempt; tooling uncertainty is not evidence that the correction fails.

Preflight matched authorized worktree, branch and HEAD `d704cba13ec93e0935d48adaa22a340e0d33e46d`. Only NearbyPlayersScreen.tsx and this report were modified, index empty. Frozen Loop 3 remained clean at `53fc064d361b565aa793b7929b18379ae4607970`. Reused existing iPhone 17 Pro / iOS 26.4 Simulator and existing app session with synthetic nearby players. The existing process-only Expo launcher asserts `http://127.0.0.1:54821` and disables dotenv; prior actual-bundle local-target evidence is preserved above. No data mutations, reinstall, rebuild, dependency changes or backend suites were performed in this follow-up.

| Native check | Result | Observable evidence |
| --- | --- | --- |
| A. Filter-area scrolling, down and back to top | INCONCLUSIVE | Compared Simulator screenshots before/after coordinate scroll over filter description (one page), drag from filter description upward, and accessibility-targeted scroll over filter heading (two pages). First two showed no meaningful movement; third showed only approximately 9 pixels of offset, not a reliable requested scroll distance or round trip. No full scrolling pass claimed. |
| B. Player 01 fully visible and controls usable | INCONCLUSIVE | Initially only the upper strip was visible. Accessibility View Profile activation and return brought both action buttons into view, but the lower part of the card remained below the viewport. Offscreen accessibility activation does not prove normal gesture reachability or a fully visible card. |
| C. Player 15 fully visible and reachable | INCONCLUSIVE | No reliable gesture reached the last card; no screenshot showed Player 15. Loaded/accessibility records and previous component/backend results are not substituted for visibility. |
| D. Header and bottom clearance | INCONCLUSIVE | Header remained below the status/island area on Nearby and Opponent Profile and after return. Bottom-card clearance and complete content visibility were not observable. Nearby is a stack route with a back control, not a visible bottom-tab screen; bottom-tab usability was not newly exercised. |
| E. Player profile navigation and return | INCONCLUSIVE (navigation subcheck PASS) | Accessibility activation of Player 01 View Profile opened visible Opponent Profile with Nearby Player 01 and @nearby_player_01. Back returned to populated Nearby Players with Player 01 actions visible. Correct destination and return passed, but continued list scrolling usability remains unverified. |

Three supported gesture alternatives were attempted, then stopped rather than repeating unreliable input. The tool accepted calls but did not produce sufficient observable movement. Accessibility clicking did navigate and shift the list offset; that is separate evidence and is not a swipe pass. Screenshots and accessibility states were observed directly through CUA in this session; no standalone screenshot artifact was created.

Founder manual verification is still needed only for the unresolved behavior: swipe from the filter area down and back to the top; fully expose Player 01 and Player 15 including their actions; confirm last-card/bottom clearance and list usability after returning from a profile. The correct Player 01 profile destination and back navigation do not need repeating for identity verification. Existing seven manual passes and prior focused regression evidence remain preserved.

`npm run typecheck` and `git diff --check` passed. No source changes in this follow-up. No commit: both expected files remain unstaged, index empty, HEAD unchanged. Existing local QA environment remains available for manual verification. VoiceOver and second-device coverage remain deferred; the previous web confirmation automation limitation remains non-blocking with existing native/component evidence.

PRODUCTION DATABASE MODIFIED: NO. PRODUCTION FUNCTIONS DEPLOYED: NO. PRODUCTION DATA MODIFIED: NO. PUSH PERFORMED: NO. MERGE PERFORMED: NO. 4.2F-2 STARTED: NO.


## Founder verification and final closure (2026-10-10)

**LOOP 4.2F-1 COMPLETE — LOCAL FUNCTIONAL QA PASSED.** Nearby Players P2 scrolling defect: **RESOLVED LOCALLY — NOT DEPLOYED**. This decision supersedes earlier blocked/pending classifications while preserving their evidence above.

The founder explicitly returned the following results for the prepared iPhone 17 Pro / iOS 26.4 isolated local synthetic QA environment and confirmed **Testing finished: YES**. These are founder-observed native results, not automated gesture passes:

| Native check | Final result and evidence source |
| --- | --- |
| Filter-area scrolling to bottom and back | PASS — founder confirmed scrolling from filters to bottom and back. |
| Player 01 visibility | PASS — founder confirmed the full card including controls was visible. |
| Player 15 visibility | PASS — founder confirmed the full last card including controls was visible. |
| Header and bottom clearance | PASS — founder confirmed correct header and unobstructed bottom controls. |
| Player profile navigation and subsequent list usability | PASS — prior direct native observation established correct Player 01 profile and return; founder now confirmed scrolling works after returning from the profile. |

No further founder check is required for this correction. The seven earlier manual screen/keyboard passes and focused component, local backend and web evidence remain valid as documented; no broad suites were repeated. No new product defect was reported. VoiceOver and second-device coverage remain deferred. Web confirmation automation limitations remain non-blocking based on existing native/component evidence. Automated simulator gesture reliability remains a tooling limitation, with the functional uncertainty resolved by founder observation. No production or comprehensive accessibility certification is claimed.

Final preflight retained the expected branch and pre-commit HEAD, exactly the two authorized modified files, and an empty index. Reviewed the full source and report diff. `npm run typecheck` and `git diff --check` passed. Local checkpoint scope is only `src/modules/discovery/presentation/NearbyPlayersScreen.tsx` and this report, with the authorized message `Loop 4.2F-1: fix Nearby Players native scrolling`. Frozen Loop 3 remains clean at `53fc064d361b565aa793b7929b18379ae4607970`. No additional source changes, deployment or next-loop work. Local QA services were left in their existing state during this documentation/checkpoint turn.

PRODUCTION DATABASE MODIFIED: NO. PRODUCTION FUNCTIONS DEPLOYED: NO. PRODUCTION DATA MODIFIED: NO. PUSH PERFORMED: NO. MERGE PERFORMED: NO. 4.2F-2 STARTED: NO.
