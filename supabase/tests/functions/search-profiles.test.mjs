// Run from an isolated local Supabase project with this repository's functions served.
// Uses only local CLI status; credentials and synthetic fixture passwords stay in memory.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const cli = process.env.SUPABASE_CLI_PATH ?? "supabase";
const output = execFileSync(cli, ["status", "-o", "json"], { encoding: "utf8" });
const config = JSON.parse(output.slice(output.indexOf("{")));
const apiUrl = new URL(config.API_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname), "Disposable local API required");
const prefix = `search${randomUUID().replaceAll("-", "").slice(0, 10)}`;
const password = `Local-only-${randomUUID()}!`;
const authIds = [];
let assertions = 0;
let passed = 0;
let failed = 0;

async function call(path, { token = config.SERVICE_ROLE_KEY, method = "GET", body } = {}) {
  const response = await fetch(new URL(path, apiUrl), {
    method,
    headers: {
      apikey: config.ANON_KEY,
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...(body === undefined ? {} : { "Content-Type": "application/json", Prefer: "return=minimal" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
function status(result, expected) {
  assertions++;
  assert.equal(result.status, expected, `Expected HTTP ${expected}, received ${result.status}`);
  return result.body;
}
function equal(actual, expected) { assertions++; assert.deepEqual(actual, expected); }
async function fixture(suffix, { login = false, onboarded = true, profile = true } = {}) {
  const email = `${prefix}-${authIds.length}@rival.local`;
  const auth = status(await call("/auth/v1/admin/users", { method: "POST", body: { email, password, email_confirm: true } }), 200);
  authIds.push(auth.id);
  const id = randomUUID();
  const username = prefix + suffix;
  if (profile) {
    status(await call("/rest/v1/profiles", { method: "POST", body: {
      id, auth_user_id: auth.id, email, username, display_name: "Local Search QA",
      onboarding_completed: onboarded, vancouver_area: "Downtown"
    } }), 201);
    status(await call("/rest/v1/profile_stats", { method: "POST", body: { profile_id: id } }), 201);
    status(await call("/rest/v1/profile_sports", { method: "POST", body: { profile_id: id, sport_id: 3, skill_level: "intermediate", is_active: true } }), 201);
  }
  const token = login ? status(await call("/auth/v1/token?grant_type=password", {
    method: "POST", token: null, body: { email, password }
  }), 200).access_token : null;
  return { id, username, token };
}
const search = (actor, query, extra = "") => call(`/functions/v1/search-profiles${query === undefined ? "" : `?query=${encodeURIComponent(query)}${extra}`}`, { token: actor.token });
async function expectProfiles(actor, query, profiles, extra = "") {
  const payload = status(await search(actor, query, extra), 200);
  equal(Object.keys(payload), ["profiles"]);
  equal(payload.profiles.map(row => row.id).sort(), profiles.map(row => row.id).sort());
  return payload.profiles;
}
async function test(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
async function social(actor, action, target) {
  status(await call("/functions/v1/manage-social", { token: actor.token, method: "POST", body: { action, targetProfileId: target.id } }), 200);
}

try {
  const a = await fixture("viewer", { login: true });
  const literal = await fixture("player_one", { login: true });
  const stripped = await fixture("playerone");
  await fixture("playerXone");
  const multiple = await fixture("two__parts");
  const percent = await fixture("rate%one");
  await fixture("rateone");
  const slash = await fixture("path\\one");
  await fixture("pathone");
  const trailing = await fixture("trail\\");
  const star = await fixture("star*one");
  await fixture("starANYone");
  const regex = await fixture("re[ab].+?(x){2}|^$");
  const options = await fixture("(?c)one");
  const unicode = await fixture("café_one");
  const incomplete = await fixture("incomplete_one", { onboarded: false });
  const noProfile = await fixture("noProfile", { login: true, profile: false });

  await test("literal underscore returns intended player, excludes stripped/wildcard neighbors", () => expectProfiles(a, literal.username, [literal]));
  await test("multiple literal underscores", () => expectProfiles(a, multiple.username, [multiple]));
  await test("case-insensitive literal username", () => expectProfiles(a, literal.username.toUpperCase(), [literal]));
  await test("substring around underscore", () => expectProfiles(a, prefix + "player_", [literal]));
  await test("trimmed input preserves literal username", () => expectProfiles(a, `  ${literal.username}  `, [literal]));
  await test("plain stripped username still finds only its own player", () => expectProfiles(a, stripped.username, [stripped]));
  await test("percent is literal and does not match stripped neighbor", () => expectProfiles(a, percent.username, [percent]));
  await test("percent cannot broaden a suffix search", () => expectProfiles(a, prefix + "%", []));
  await test("underscore cannot act as one-character wildcard", () => expectProfiles(a, prefix + "player_on_", []));
  await test("literal backslash is preserved", () => expectProfiles(a, slash.username, [slash]));
  await test("trailing backslash cannot escape substring boundary", () => expectProfiles(a, trailing.username, [trailing]));
  await test("PostgREST star alias cannot broaden literal input", () => expectProfiles(a, star.username, [star]));
  await test("regex punctuation remains literal", () => expectProfiles(a, regex.username, [regex]));
  await test("regex option syntax remains literal", () => expectProfiles(a, options.username.toUpperCase(), [options]));
  await test("accented case-insensitive substring", () => expectProfiles(a, unicode.username.toUpperCase(), [unicode]));
  await test("missing, empty and one-character queries retain empty response", async () => {
    for (const q of [undefined, "", " ", "a", "_", "%", "\\"]) await expectProfiles(a, q, []);
  });
  await test("oversized no-match input retains bounded empty response (no prior max length)", () => expectProfiles(a, "z".repeat(2048), []));
  await test("malformed-looking percent/filter syntax stays literal", async () => {
    for (const q of [prefix + "%ZZ", prefix + ",id.neq.null", prefix + "' OR true --", prefix + "(?i).*", prefix + "[", prefix + "\\d"]) await expectProfiles(a, q, []);
  });
  await test("self is excluded even with caller-supplied exclusion/limit hints", () => expectProfiles(a, a.username, [], "&excludeProfileId=ignored&limit=999"));
  await test("incomplete profiles remain excluded", () => expectProfiles(a, incomplete.username, []));
  await test("response keys remain exactly allowlisted including nested data", async () => {
    const [row] = await expectProfiles(a, stripped.username, [stripped]);
    equal(Object.keys(row).sort(), ["availability_status", "display_name", "id", "profile_sports", "profile_stats", "username", "vancouver_area"]);
    const stats = Array.isArray(row.profile_stats) ? row.profile_stats[0] : row.profile_stats;
    equal(Object.keys(stats), ["matches_played"]);
    equal(Object.keys(row.profile_sports[0]).sort(), ["is_active", "skill_level", "sports"]);
    equal(Object.keys(row.profile_sports[0].sports), ["slug"]);
  });
  await test("unauthenticated and invalid sessions denied (existing status)", async () => {
    for (const token of [null, "invalid"]) {
      const body = status(await search({ token }, literal.username), 500);
      equal(Object.keys(body), ["error"]);
      assertions++; assert.ok(!JSON.stringify(body).includes(literal.id));
    }
  });
  await test("authenticated user without canonical profile remains denied", async () => {
    equal(status(await search(noProfile, literal.username), 404), { error: "Profile not found for authenticated user" });
  });
  await test("unsupported method remains denied", async () => { status(await call("/functions/v1/search-profiles", { token: a.token, method: "POST", body: {} }), 405); });
  await test("NUL input is rejected without query internals", async () => {
    const result = await search(a, prefix + "\0invalid");
    equal(status(result, 400), { error: "Invalid search query" });
  });
  await test("blocked literal search is filtered in both directions and restored after unblock", async () => {
    await social(a, "block", literal);
    await expectProfiles(a, literal.username, []);
    await expectProfiles(literal, a.username, []);
    await expectProfiles(a, stripped.username, [stripped]);
    await social(a, "unblock", literal);
    await expectProfiles(a, literal.username, [literal]);
    await expectProfiles(literal, a.username, [a]);
  });
  await test("result limit remains twenty despite limit hints", async () => {
    for (let i = 0; i < 22; i++) await fixture(`bulk${String(i).padStart(2, "0")}`);
    const rows = status(await search(a, prefix + "bulk", "&limit=999"), 200).profiles;
    equal(rows.length, 20);
    equal(rows.map(row => row.username), Array.from({ length: 20 }, (_, i) => `${prefix}bulk${String(i).padStart(2, "0")}`));
  });
} finally {
  // No challenges/matches are created here; profile/auth cascades remove all fixtures.
  for (const id of authIds.reverse()) status(await call(`/auth/v1/admin/users/${id}`, { method: "DELETE" }), 200);
}

console.log(`Search regression: ${passed} passed, ${failed} failed; ${assertions} assertions including fixture/status/cleanup checks.`);
if (failed) process.exitCode = 1;
