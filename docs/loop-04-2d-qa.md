# Loop 4.2D — Friendship UI local QA

## Scope and architecture

Local friendship UI only. `OpponentProfileScreen` loads the four normalized states (`none`, `outgoing_pending`, `incoming_pending`, `friends`) from `socialService`, keeps Challenge/Rematch primary, and reloads the authoritative relationship after mutations. Its friendship action is hidden until that load completes. Remove Friend uses a confirmation that says matches, stats, and rivalry history remain unchanged. A generic unavailable state does not reveal block direction.

The existing Inbox now renders `FriendRequestsPanel` before challenge content. It fetches incoming and outgoing requests on focus/foreground and after actions; identities open Opponent Profile. The existing device-local challenge-attention badge adds the current incoming request count only. Outgoing requests and accepted friendships do not contribute. No new notification storage or realtime subscription was added. The badge updates on tab changes, foreground, and existing challenge activity, not continuously while the app remains open on an unrelated screen.

Owner Profile has a Friends entry. The typed `Friends` stack route displays accepted friends from `getFriends()`, using initials rather than fetching avatars from a broader projection. It refreshes on focus and provides a Find Player action when empty. It delegates Challenge/Rematch to Opponent Profile.

## Isolated runtime

The pre-existing disposable Supabase project at `/private/tmp/rival-loop42a.UOslir` was restarted on dedicated 544xx ports. Its local migration and Edge Functions were used; the separate baseline stack was not touched. Expo web ran on port 19006 with **process-only** `EXPO_PUBLIC_SUPABASE_URL` and local anon key. No `.env` file or production configuration was modified. Two controlled local Auth users were used for initial QA; two more were created for targeted QA. Profile/stat fixtures were confined to that disposable database. They are not production accounts. The app and local project were stopped after QA.

## Authenticated app QA performed

- A signed in, found B by username fragment, opened B's profile, saw Challenge above Add Friend, sent a request, and saw Request Sent/Cancel Request after authoritative refresh.
- A's Inbox showed the outgoing request with B's public identity. B signed in and saw Inbox badge `1`, an incoming request with A's identity, and Accept/Decline. Tapping identity opened A's profile with Accept Friend Request/Decline and Challenge still primary.
- B accepted on Opponent Profile; the relationship changed to Friends. Inbox refresh removed the request. B's Friends screen showed A; tapping A returned to Opponent Profile. Back returned to Friends.
- B opened Remove Friend confirmation. Cancel preserved Friends. Confirm changed the relationship to Add Friend and Friends refreshed to its empty state. Both profiles' visible zero-match records remained unchanged; a historical match fixture was **not** used.
- B sent, canceled, and re-sent a request from Opponent Profile. B's Inbox displayed only the outgoing request; Cancel there removed it. Outgoing-only state did not show an Inbox badge.
- A sent a new request through the local authenticated API as a controlled cross-device fixture. B's badge became `1` on returning Home; Inbox focus showed the request. B declined in Inbox and the incoming row disappeared.
- Find Player → Opponent Profile → Back, Inbox request → Opponent Profile → Back, and Profile → Friends → Opponent Profile → Back → Friends were exercised in the web app. The Friends empty-state Find Player route also opened correctly.

## Static and existing automated validation

- `npm run typecheck`: pass.
- `git diff --check`: pass.
- Existing local authenticated social API test: pass, 124 assertions.
- Temporary dependency copy came from frozen Loop 3 after identical `package-lock.json` hashes were confirmed; no symlink was used. It was removed after testing.

## Targeted QA completion (local, isolated)

| Flow | Status | Evidence / boundary |
| --- | --- | --- |
| Two-sided friendship after request acceptance | VERIFIED LOCALLY | New C/D users: C sent from Opponent Profile; D saw incoming Inbox request and accepted; both D and C subsequently saw the other in Friends, and C's Opponent Profile showed Friends. |
| Simultaneous reciprocal-send auto-accept through UI | DEFERRED | An incoming request renders Accept/Decline, not Add Friend, so a second send is not naturally reachable through this UI. The backend reciprocal-send behavior was tested in Loop 4.2B; no client-side state inference was added. |
| Live blocked Opponent Profile | VERIFIED LOCALLY | A blocked B through the local authenticated API after B had been reachable. History/Home View Profile then showed only “This profile is unavailable.” C later blocked accepted friend D; a stale Remove Friend attempt ended at the same generic unavailable screen. No block direction appeared. Back remained functional. |
| Friends cleanup after block | VERIFIED LOCALLY | C/D were friends before block. Returning from stale D profile to C's Friends screen refreshed it to “No friends yet.” |
| Active request-list cleanup after block | REVIEWED IN CODE | The blocked C/D pair had already accepted and had no active requests, so this was not exercised in the app. |
| Blocked Rematch and direct backend guard | VERIFIED LOCALLY | A's Home Rematch shortcut still opened the correctly locked B/pickleball composer. Send returned generic “Opponent profile not found,” without a crash. A service-role read of local challenges found no A→B direct challenge created. The blocked generic direct Challenge path uses the same existing composer/backend guard but was not separately clicked. |
| Unblocked direct Challenge | VERIFIED LOCALLY | B used Find Player → A Opponent Profile → Challenge. Composer locked A and prefilled pickleball. One challenge was sent; B's sent Inbox showed one pending item; A's received Inbox showed it and A accepted. |
| Results and historical rematch | VERIFIED LOCALLY | A submitted a local 11-8 win and B confirmed; Profile History retained opponent identity, score, and 1-match record. Home and Opponent Profile Rematch opened the locked A/pickleball composer. After A blocked B, A's historical row and 1-0-0 rivalry remained, while View Profile became generically unavailable. |
| Nearby | VERIFIED LOCALLY | Local A/B profiles were given active pickleball and Downtown/today eligibility. A saw B in the standard Nearby list. A missing View Profile entry was added to the full-app row; tapping it opened B's correct Opponent Profile with friendship/competitive controls, and Back returned to Nearby. Existing Challenge remained on the row. Sandbox Nearby modes were not changed. |
| Quick Match / open challenge | VERIFIED LOCALLY | B posted an open challenge in the app; A saw B in Play Now and joined successfully. A also saw a second B open fixture before block. After A blocked B, a stale Join returned generic “This open challenge is no longer available” without a crash; re-entering Play Now filtered B's card. |
| Cooldown and stale mutations | VERIFIED LOCALLY | The backend returned `409 cooldown` for B→A after a prior decline. The UI had been immediately clearing that message during refresh; the narrow fix now keeps “Please wait before sending another friend request” and Retry visible. Stale Remove Friend after a block failed safely and hid controls. |
| Other network/uncommon states | REVIEWED IN CODE | Opponent Profile, Friends, and Inbox use error/retry paths and authoritative refresh. Offline request failure, concurrent accept/decline race, and independent remote friend removal were not manufactured in the app. |
| iOS/Android and screen reader | DEFERRED | No immediately available device/simulator QA was used; carry this to the final Loop 4 regression gate. |

### Username underscore investigation

The exact `_` mismatch is a pre-existing `search-profiles` behavior from commit `e5c6f421` (August 2026), not introduced by Loop 4.2D. The function strips `%` and `_` from the incoming query **before** `.ilike("username", `%${query}%`)`; therefore an exact underscore-containing username becomes a different string and fails to match, while a fragment does match. SQL `ILIKE` wildcard semantics are not the direct cause of the observed false negative because `_` has already been removed. A separate search fix should preserve literal characters while escaping `LIKE` metacharacters correctly. No backend/search code was changed in 4.2D. This affects discoverability, not the authenticated social authorization checks observed here.

### Remaining limitations and safety

- Inbox friend-request attention is a current incoming count refreshed at existing lifecycle points, **not** a durable cross-device unread notification system. It can be stale while the app stays active on another screen until navigation/foreground refresh.
- The local app used process-only configuration against the disposable project; it was stopped after targeted QA. No production `.env` file, database, function, or user data was changed.
- Friendship UI is not deployed. Blocking UI is not implemented. The production social migration/functions/enforcement are not deployed. No chat, push notifications, or social feed were added.
- A full final Loop 4 regression and production runtime verification remain deferred; the focused local paths above do not substitute for those gates.
