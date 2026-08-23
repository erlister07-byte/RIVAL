# Loop 2 QA Results

## Scope

Phase 1 covers:

Nearby Players → Player Selected → Create Direct Challenge → Pending Challenge → reload → persisted Pending.

It does not include challenge responses, cancellation, match lifecycle, results, disputes, Open Challenge, or progression systems.

## Branch and Runtime Modes

- Branch: `codex/loop-02-challenge-match`
- Base: stabilized Loop 1 commit `8106dcc7`
- `loop-01` remains an explicit player-selection-only sandbox.
- `loop-02` is an explicit direct-challenge sandbox.
- Omitting the startup mode, or using `full-app`, retains the normal full-app default.

## Authentication Architecture

Firebase Auth → Firebase ID token → authenticated Edge Function → internal Firebase token verification → server-derived RIVAL profile → service-role Supabase operation.

The client does not provide the challenger profile, Firebase UID, creator identity, or initial challenge status.

## Edge Functions

- `create-direct-challenge`
- `get-user-challenges`

Both functions were deployed to `rgquxhkburgpzghwslbd` with `verify_jwt = false`; each verifies Firebase ID tokens internally. No migration, RLS weakening, or anonymous-RLS bypass was used.

## Happy-Path QA

- **Authentication and hydration — PASS:** an authenticated, onboarding-complete user bypassed Welcome, verification, and onboarding; Nearby Players loaded and displayed the eligible QA player.
- **Player selection — PASS:** the selected-player state showed basic identity, Pickleball, skill level, area, distance, Back to Nearby Players, and the Loop 2-only Challenge Player action.
- **Create Challenge navigation — PASS:** Challenge Player opened a direct Challenge screen with the intended locked opponent, Pickleball, Singles, timing, Kits Beach Courts, Bragging Rights, and Send Challenge.
- **Direct challenge creation — PASS:** Send Challenge was used once, completed without a visible error, and navigated to Pending Challenges.
- **Sender pending state — PASS:** the pending card showed the intended opponent, Pickleball / Bragging Rights, and the configured location and time.
- **Persistence after reload — PASS:** after reload, Pending Challenges displayed the original challenge as Pending. No additional challenge was created.

## Security QA

- **Missing Firebase token — PASS:** both Phase 1 functions returned `401`; no mutation path was reached.
- **Malformed Firebase token — PASS:** both Phase 1 functions returned `401`; no mutation path was reached.
- **Spoofed retrieval at the authentication boundary — PASS:** a spoofed profile field with malformed authentication returned `401` and could not bypass authentication.
- **Server-side input hardening — STATIC PASS:** `create-direct-challenge` rejects unsupported fields, derives the caller only from verified Firebase claims, assigns `pending` server-side, rejects self-challenge, checks both profiles' active Pickleball eligibility, and validates supported configuration values.
- **Authenticated negative cases — LIMITED:** self-challenge, nonexistent-opponent, valid-token caller/status spoofing, and invalid-payload responses were not issued because that would require handling an authenticated Firebase token outside the normal QA flow. The static safeguards are present but those response paths were not runtime-captured.

## Database and Downstream Isolation

- **Challenge row details — LIMITED:** persisted pending state, opponent, configuration, and timing were confirmed through the sender's post-reload Pending Challenges view. Direct row-level database inspection was not available without accessing credentials or a signed-in dashboard session.
- **Match absence — SCHEMA/TRIGGER AUDIT PASS:** the `create_match_on_accepted_challenge` trigger runs only on a challenge update to `accepted`; a `pending` insert does not create a match.
- **Result absence — STATIC PASS:** no Phase 1 screen, provider effect, or Edge Function calls result creation or result mutation.
- **Inherited activity event — ACCEPTED:** the pre-existing `activity_event_on_challenge_insert` trigger may create one `challenge_created` activity row for a new challenge. This is a transactionally coupled database side effect that predates Loop 2; it is not exposed as a Phase 1 product feature.
- **Downstream progression — STATIC PASS:** Phase 1 does not invoke XP, rating/ELO, badge, streak, leaderboard, rivalry, rematch, match, or result behavior. Direct database verification of those tables was not available.

## Duplicate Protection

- **Immediate UI protection — PASS:** Create Challenge has an in-flight submission guard and disables the action while sending; manual QA submitted once.
- **Server concurrency semantics — NOT DESTRUCTIVELY TESTED:** no second valid pending challenge was created to test duplicate/race behavior. No claim of database-level race protection is made.

## Runtime Isolation

- **Static isolation — PASS:** Loop 2 mounts only Nearby Players, Create Challenge, and the limited pending inbox. It does not mount Tabs/Home, Activity, Results, the full challenge inbox, or its realtime subscription.
- **Provider isolation — PASS:** Loop 2 suppresses home refresh, profile secondary stats/recent matches, challenge provider loading, match provider loading, and provider nearby-player prefetch.
- **Runtime network capture — LIMITED:** no independent browser Network capture was recorded for unrelated requests or realtime subscriptions. Static isolation does not substitute for that capture.

## Friend Search

Friend Search remains a full-app secondary path and is not reachable from the Loop 2 navigator. It was not secured or connected in this phase to avoid broadening the canonical Nearby Players flow; it is deferred and does not block Phase 1.

## Phase 2 Scope

Phase 2 adds direct-challenge responses only: Incoming Accept, Incoming Decline, and Outgoing Cancel. It does not add result submission, result confirmation, disputes, Open Challenge, or progression behavior.

## Phase 2 Security Boundary

Firebase ID tokens are verified internally and the caller profile is derived server-side. The client sends only challengeId and one supported action: accept, decline, or cancel. Accept and Decline require the recipient; Cancel requires the sender. Direct challenges only are accepted. The conditional update includes the authorized role and pending guard; malformed payloads return 400, wrong role 403, missing challenges 404, and terminal/race updates 409. The client provides no profile ID, Firebase UID, participant role, resulting status, or match ID.

## Phase 2 Accept QA

- **PASS:** Keither received Ryan's incoming Pending challenge with Accept and Decline visible and Cancel absent.
- **PASS:** One Accept action produced the Challenge Accepted terminal state naming Ryan and stating that a match was created; result handling was not exposed.
- **STATIC PASS:** the accepted transition relies on the existing accepted-challenge trigger; the trigger-owned insert uses the unique challenge link and conflict guard, with initial pending_submission status.
- **INHERITED ACTIVITY:** the existing trigger may create one challenge_accepted event. Neither the client nor response function creates activity manually.
- **LIMITED:** exact challenge, match, and activity-event rows were not inspected directly.

## Phase 2 Decline QA

- **PASS:** Keither received Ryan's incoming Pending challenge with Accept and Decline visible and Cancel absent.
- **PASS:** One Decline action produced the Challenge Declined terminal state naming Ryan and stating that the challenge was no longer pending.
- **STATIC PASS:** Decline changes pending to declined without a match, result, or progression path.
- **PASS:** no challenge_declined activity event exists in the current activity schema or triggers.
- **LIMITED:** the exact declined challenge row was not inspected directly.

## Phase 2 Cancel QA

- **PASS:** Ryan saw an outgoing Pending challenge to Keither with Cancel Challenge visible and Accept/Decline absent.
- **PASS:** One Cancel action produced the Challenge Canceled terminal state naming Keither and stating that the challenge was no longer pending.
- **STATIC PASS:** the canonical database status is canceled; the sender-only transition sets canceled_at and cannot create a match, result, or progression path.
- **PASS:** no challenge_canceled activity event exists in the current activity schema or triggers.
- **LIMITED:** the exact canceled challenge row was not inspected directly.

## Match Trigger Regression

- **PASS:** respond-to-challenge never inserts a match; it reads a match only after acceptance.
- **PASS:** the existing accepted-challenge trigger remains the sole match-creation path and is guarded by accepted status.
- **PASS:** Decline and Cancel cannot satisfy that accepted-only trigger. Result submission remains outside Loop 2 Phase 2.

## QA Session Diagnostic

- An apparent discovery discrepancy was caused by the QA browser being authenticated as Keither while it was believed to be Ryan.
- Self-exclusion was correct; Ryan and Keither have distinct Firebase identity mappings.
- Temporary discovery diagnostics were removed. get-nearby-players was restored exactly to Loop 1 baseline c9a9b65a and redeployed.
- No product discovery fix was required.

## Phase 2 Limitations

- Direct row-level verification remains limited for exact challenge, match, result, and activity-event counts.
- Concurrency protection is validated primarily by the atomic conditional update and schema/trigger reasoning; it was not independently runtime-raced.
- No claim is made for unrun result lifecycle, Open Challenge, or progression tests.

## Loop 1 Regression

**PASS (prior manual regression):** In the separate Loop 1 sandbox, Nearby Players and the selected-player terminal state remained available, while Challenge Player and Pending Challenges were absent. The final Phase 2 source review confirms those Loop 1-only conditions remain unchanged; no dedicated Loop 1 Expo process was available for a new runtime pass.

## Phase 3 Scope

Phase 3 covers only: accepted direct match → Match Inbox → Submit Result → `pending_confirmation` → participant waiting state. It does not expose confirmation, rejection, disputes, auto-confirm, ratings, XP, stats progression, badges, leaderboards, rivalries, rematches, activity, Open Challenge, the full Results Inbox, or realtime subscriptions.

## Phase 3 Hardening

- **Migration — APPLIED:** `20260817_loop2_phase3_match_result_hardening.sql` was manually applied through the Supabase Dashboard, then recorded as applied with the one-entry migration repair for `20260817`. Its SQL was not rerun through `db push`.
- **Result boundary — LIVE/STATIC PASS:** browser roles cannot directly update `public.matches` or execute result-submit, confirm, reject, or auto-confirm RPCs. The service-role Edge Function remains the approved submission path.
- **Trigger hardening — LIVE/STATIC PASS:** result-trigger challenge completion/reversion and profile-stat recalculation run only across the confirmed boundary. `pending_submission` → `pending_confirmation` does not recalculate profile stats; match-completed activity remains confirmed-only.
- **Migration history — OUTSTANDING:** fifteen historical local/remote migration discrepancies remain. `db push` and `--include-all` remain prohibited until a separate audit reconciles them.

## Phase 3 Retrieval QA

- **PASS:** the accepted Aug 12 and Aug 18 direct matches appeared separately in the participant-scoped Match Inbox.
- **PASS:** the Aug 18 match was selected as the Phase 3 fixture; its counterpart, sport, location, schedule, and `Ready for a result` state rendered correctly.

## Phase 3 Submission QA

- **PASS:** Submit Result exposed only the two participant winner choices and an optional score field.
- **PASS:** Keither submitted the Aug 18 result once with score `11-7` and received the Result Submitted terminal state.
- **PASS:** the submitter saw the persisted waiting state after refetch, including `Score: 11-7`, with no resubmit action.
- **PASS:** Ryan saw the opponent-submitted waiting state with the score and no Submit, Confirm, Reject, or Dispute control.

## Phase 3 Focus-Refresh Regression

- **FIXED:** returning from Result Submitted initially revealed a retained Match Inbox card in its stale `pending_submission` state.
- **Cause:** Match Inbox fetched only on mount or manual refresh.
- **Fix:** `useIsFocused` now reruns the existing `getUserMatches()` effect when Match Inbox regains focus and does not fetch while unfocused.
- **PASS:** navigating away and back refreshed the Aug 18 waiting state immediately without manual Refresh; the untouched Aug 12 match remained `Ready for a result`.
- **Isolation:** no realtime subscription or backend behavior was introduced.

## Phase 3 Limitations

- Direct row-level match and challenge verification was not available in this session; persisted state is supported by successful Edge Function responses and both participants' refreshed UI.
- Negative/security cases not runtime-executed are recorded as static or live-privilege verification rather than runtime-response passes.
- The fifteen historical migration-history discrepancies remain outstanding.

## Phase 4 Scope

Phase 4 covers only `pending_confirmation` → `confirmed` or `disputed`, then stops. It does not add dispute resolution, result resubmission, auto-confirm, Open Challenge, full Results Inbox behavior, realtime result subscriptions, or progression UI.

## Phase 4 Security Boundary

Firebase Auth → Firebase ID token → Firebase-authenticated Edge Function → internal token verification → server-derived caller profile → service-role RPC.

- `confirm-match-result` and `reject-match-result` accept only `{ matchId }`; neither accepts a profile ID, Firebase UID, lifecycle status, confirmation method, challenge state, rating, stat, or progression value from the client.
- The deployed functions verify Firebase tokens internally and derive the caller from verified claims before resolving the RIVAL profile.
- Direct browser execution of the confirm, reject, submit, and auto-confirm RPCs remains revoked for anonymous and authenticated roles. No migration was required for Phase 4.

## Phase 4 Live Verification and Deployment

- **LIVE METADATA/PRIVILEGE PASS:** pre-implementation Dashboard verification confirmed confirm/reject RPCs are service-role-only. The approved canonical confirmation effects are challenge completion, basic profile-stat recount, and one trigger-owned `match_completed` activity event; ratings/ELO, XP, levels, badges, leaderboards, rivalries, rematches, and other progression are not part of this phase.
- **DEPLOYED:** `confirm-match-result`, `reject-match-result`, and the updated `get-user-matches` were deployed to `rgquxhkburgpzghwslbd` with `verify_jwt = false`, where Firebase verification is performed internally.

## Phase 4 Confirmation QA

- **MANUAL RUNTIME PASS — Aug 18 fixture:** Ryan and Keither verified the submitted Pickleball result at Kits Beach Courts, scheduled Aug 18 at 6:30 p.m., with Keither as winner and score `11-7`.
- **MANUAL RUNTIME PASS — role isolation:** Ryan, the non-submitting opponent, saw the submitted winner and score with Confirm Result and Dispute Result, but no Submit Result. Keither, the submitter, saw Result Submitted and waiting-only state with no mutation controls.
- **MANUAL RUNTIME PASS — confirmation:** Ryan confirmed once. Both participants subsequently saw Result Confirmed with Keither as winner and score `11-7`; no Confirm, Dispute, or Submit Result controls remained.
- **MANUAL RUNTIME PASS — focus refresh:** returning to Match Inbox without manual Refresh showed the confirmed terminal state.

## Phase 4 Dispute QA

- **MANUAL RUNTIME PASS — Aug 19 fixture:** a fresh direct Pickleball challenge at Kits Beach Courts, scheduled Aug 19 at 6:30 p.m., was accepted and brought to pending confirmation with Keither as submitted winner and score `11-7`.
- **MANUAL RUNTIME PASS — role isolation:** Ryan saw Confirm Result and Dispute Result only; Keither saw the waiting-only submitted state.
- **MANUAL RUNTIME PASS — dispute:** Ryan disputed once. Both participants subsequently saw Result Disputed, the submitted winner, and score `11-7`, with no mutation controls.
- **STATIC/LIVE PRIVILEGE PASS:** the dispute transition remains terminal in Loop 2; no resolution or resubmission UI was introduced.

## Phase 4 Regression and Isolation

- **Phase 1 — MANUAL RUNTIME PASS:** the Aug 19 fixture used the established Nearby Players → direct challenge → pending challenge path. Phase 4 did not modify discovery, challenge creation, navigation, or Loop 1 selection-only behavior.
- **Phase 2 — MANUAL/STATIC PASS:** the fresh Aug 19 fixture exercised the existing Accept path and match creation. Decline and Cancel were not re-run; static review confirms Phase 4 did not change their client, function, or canonical `canceled` behavior.
- **Phase 3 — MANUAL RUNTIME PASS:** the Aug 19 fixture exercised accepted match retrieval, participant-only winner selection, score submission, submitter waiting state, opponent visibility, and focus refresh. The Aug 12 fixture remains `pending_submission` and still shows Ready for a result with Submit Result available; it was not mutated.
- **Excluded behavior — STATIC/RUNTIME PASS:** Loop 2 invokes no auto-confirm, rating/ELO, XP, level, badge, leaderboard, rivalry, rematch, notification, realtime subscription, full Results Inbox, Open Challenge, dispute-resolution, or activity-feed UI. The accepted trigger-owned `match_completed` activity event and basic profile-stat recount remain canonical confirmation side effects only.
- **Match Inbox scope — STATIC/RUNTIME PASS:** retrieval remains participant-scoped to direct, non-open matches in `pending_submission`, `pending_confirmation`, `confirmed`, or `disputed` states. Terminal direct matches are retained for both participants, but the screen adds no historical result-feed grouping, full Results Inbox navigation, or realtime behavior.

## Phase 4 Limitations

- Confirmation and dispute states were verified through both participants' refreshed UI and deployed function responses; direct SQL inspection of every resulting row, profile-stat recount, and trigger-owned activity row was not performed during manual QA.
- Destructive concurrency races and authenticated negative request bodies were not re-run for Phase 4; authorization and terminal guards are supported by deployed privilege verification and source review.

## Loop 2B Open Challenge Phase 1

- **Security boundary — PASS:** create, list, accept, and cancel use Firebase-authenticated Edge Functions with internally verified Firebase tokens and server-derived caller profiles. The browser supplies no trusted profile, Firebase UID, or lifecycle state.
- **Creation — MANUAL RUNTIME PASS:** Keither posted a fresh Pickleball Open Challenge for Aug 20 at 6:30 p.m. at Kits Beach Courts with Bragging Rights through Nearby Players → Open Challenges → Post Open Challenge. It appeared under Your Open Challenge with creator-only Cancel Open Challenge control.
- **Discovery and acceptance — MANUAL RUNTIME PASS:** a second account discovered the fixture as another player's Open Challenge and joined once. The challenge closed and both participants saw exactly one Aug 20 canonical Match Inbox entry in pending_submission / Ready for a result state.
- **Loop 2A handoff — MANUAL RUNTIME PASS:** the accepted Open Challenge entered the existing Match Inbox lifecycle; no parallel Open Challenge result path was exposed. Existing Aug 12 pending_submission, Aug 18 confirmed, and Aug 19 disputed fixtures remained intact.
- **Cancellation — MANUAL RUNTIME PASS:** the creator posted and canceled a separate fresh Open Challenge. It disappeared for both accounts and created no match.
- **Direct-challenge smoke regression — BLOCKED / NOT EXECUTED:** no eligible nearby player was available under the existing UI filters. No QA data was changed to manufacture this optional regression fixture; this is not evidence of a direct-challenge failure.
- **Negative cases — LIMITED:** creator-side Cancel Open Challenge was observed. Self-acceptance, non-owner cancellation, and a destructive duplicate-acceptance race were not independently issued. One acceptance produced one match and removed the Open Challenge from discovery.
- **Excluded behavior — PASS:** no result was submitted for the Aug 20 match. No progression, realtime, notification, auto-confirm, dispute-resolution, or parallel result UI was exposed.

## Deferred to Phase 4+

- XP, ratings/ELO, badges, streaks, leaderboards, rivalries, and rematches

## Overall Status

Loop 2 Phases 1 through 4 and Loop 2B Open Challenge Phase 1 are functionally verified through persisted sender Pending state, direct-challenge Accept/Decline/Cancel paths, authenticated Open Challenge creation/discovery/acceptance/cancellation, accepted-match retrieval, participant-scoped result submission, opponent-only confirmation/dispute, and terminal confirmed/disputed views for both participants. Direct database-row inspection, authenticated negative-response captures, database-level downstream-table inspection, server-concurrency race behavior, broader runtime Network/realtime capture, and the optional direct-challenge smoke regression remain explicitly limited.
