# Loop 4.1 Opponent Profile QA

## Implementation scope

- Added a dedicated Opponent Profile screen and typed client service backed by the authenticated `get-opponent-profile` Edge Function.
- The function projects display name, username, general area, active sports, self-assessed skill, competitive Skill Rating, and confirmed global wins, losses, draws, and matches played. Its source does not select or return private account fields or raw database rows. The exact deployed response allowlist has not been captured independently.
- The screen shows Challenge for player-search context and Rematch for a confirmed-match context. The challenge composer receives the canonical opponent profile ID and selected sport.
- Added View Profile entry points in Find Player, Profile History, and Home rematches. Existing direct Challenge and Rematch shortcuts remain available.
- The screen includes loading, unavailable, error with Retry, no-active-sports, Unrated, and initials-fallback states. Runtime coverage for these states is listed below.

## Deployment status

`get-opponent-profile` was deployed to the documented RIVAL production Supabase project and previously verified ACTIVE. The endpoint rejects missing authentication and invalid bearer tokens. No database migration or RLS change was made for Loop 4.1. This local checkpoint needs no additional deployment.

## Confirmed QA

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | Ran with compatible temporary dependencies during authenticated Expo web QA. |
| `git diff --check` | PASS | Ran during authenticated Expo web QA and again for this checkpoint. |
| Missing authentication and invalid bearer token | PASS | Deployed endpoint rejected both in prior read-only checks. |
| Find Player → View Profile → Challenge | PASS | Existing signed-in session loaded the opponent profile and opened Create Challenge with the correct locked opponent and sport. No challenge was sent. |
| Profile History → View Profile → Rematch | PASS | Existing confirmed-match context opened the correct opponent profile and rematch composer with the match sport. |
| Home rematch → View Profile → Rematch | PASS | Existing Home rematch opened the correct opponent profile and rematch composer. |
| Direct Challenge and Rematch shortcuts | PASS | Existing shortcuts preserved opponent identity and sport without opening Opponent Profile. |
| Loading and initials fallback | PASS | Loading state appeared; initials rendered when the avatar image failed. |

Back navigation worked in the exercised browser flows. No challenge, match, or result was submitted during QA.

## Not verified

- The actual deployed JSON response's exact top-level and nested field allowlist, including independent confirmation that it contains no private fields.
- Authenticated HTTP statuses and sanitized bodies for missing, malformed, self, and syntactically valid nonexistent profile IDs.
- Independent comparison of the displayed global record and Skill Rating with authoritative confirmed-result and sport-specific rating records. The observed displayed match count equalled wins plus losses plus draws, but that does not establish source accuracy.
- Runtime unavailable-profile, error and Retry, no-active-sports, Unrated, and self-profile navigation states. No production records were changed to manufacture these cases.

The browser inspection interface used for the authenticated QA did not expose the raw endpoint response. A later temporary-script approach could not obtain an approved authenticated test session: the app uses Supabase email/password sign-in, while no authorized test-account credential source was available outside the existing browser session. Browser tokens were not extracted, and a service-role key was not substituted for a user session. These checks must remain open until an approved credential-safe test method is available.

## Existing nonblocking observation

The browser logged repeated `[Avatar] image render failed` errors, and the initials fallback worked. The shared Avatar component predates Loop 4.1; the cause of the image failure (missing object or access issue) was not established. This is tracked separately from Opponent Profile endpoint verification.

## Completion boundary

The verified navigation and display flows support a local Loop 4.1 checkpoint. Complete endpoint security and data-accuracy validation still requires a credential-safe authenticated response capture, authenticated negative-ID checks, and an approved read-only comparison against authoritative record and rating sources. Do not label those checks as passed until observed.
