import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const cli = process.env.SUPABASE_CLI_PATH ?? "supabase";
const statusOutput = execFileSync(cli, ["status", "-o", "json"], { encoding: "utf8" });
const config = JSON.parse(statusOutput.slice(statusOutput.indexOf("{")));
const apiUrl = config.API_URL;
const anonKey = config.ANON_KEY;
const serviceKey = config.SERVICE_ROLE_KEY;
const runId = randomUUID().slice(0, 8);
const password = `Local-only-${randomUUID()}!`;
const users = [];
let checks = 0;

async function call(path, { token = serviceKey, key = serviceKey, method = "GET", body, prefer } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

function ok(result, expected = 200) {
  checks++;
  assert.equal(result.status, expected, JSON.stringify(result.payload));
  return result.payload;
}

async function fixture(name) {
  const email = `loop42c-${runId}-${name}@rival.local`;
  const auth = ok(await call("/auth/v1/admin/users", { method: "POST", body: { email, password, email_confirm: true } }));
  users.push(auth.id);
  const id = randomUUID();
  const username = `loop42c${runId}${name}`;
  ok(await call("/rest/v1/profiles", {
    method: "POST", prefer: "return=minimal",
    body: { id, auth_user_id: auth.id, email, username, display_name: name, vancouver_area: "Downtown", availability_status: "now", challenge_radius_km: 50, onboarding_completed: true }
  }), 201);
  ok(await call("/rest/v1/profile_stats", { method: "POST", prefer: "return=minimal", body: { profile_id: id } }), 201);
  ok(await call("/rest/v1/profile_sports", { method: "POST", prefer: "return=minimal", body: { profile_id: id, sport_id: 3, skill_level: "intermediate", is_active: true } }), 201);
  const session = ok(await call("/auth/v1/token?grant_type=password", { method: "POST", token: undefined, key: anonKey, body: { email, password } }));
  return { id, username, token: session.access_token };
}

const edge = (actor, name, body, method = "POST") => call(`/functions/v1/${name}`, {
  token: actor.token, key: anonKey, method, body
});
const profile = (actor, targetId) => call(`/functions/v1/get-opponent-profile?profileId=${targetId}`, { token: actor.token, key: anonKey });
const search = (actor, query) => call(`/functions/v1/search-profiles?query=${query}`, { token: actor.token, key: anonKey });
const nearby = (actor) => edge(actor, "get-nearby-players", { sport: "pickleball", availability: "now" });
const open = (actor) => edge(actor, "get-open-challenges", { sport: "pickleball" });
const direct = (actor, targetId) => edge(actor, "create-direct-challenge", {
  opponentProfileId: targetId, sport: "pickleball", scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
  locationName: "Local Test Court", challengeType: "casual"
});
const generic = (actor, targetId) => edge(actor, "create-challenge", {
  sportId: 3, opponentProfileId: targetId, scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
  locationName: "Local Test Court", challengeType: "casual", isOpen: false
});
const challengeRow = async (id) => ok(await call(`/rest/v1/challenges?id=eq.${id}&select=id,status,canceled_at`, { prefer: "return=representation" })).at(0);
const listIds = (payload, key) => (payload[key] ?? []).map((item) => item.id ?? item.profileId);

try {
  const a = await fixture("a");
  const b = await fixture("b");
  const c = await fixture("c");
  const unrelated = await fixture("unrelated");

  // Unblocked baseline and Loop 4.1 exact public projection.
  const unblockedProfile = ok(await profile(a, b.id)).profile;
  checks++;
  assert.deepEqual(Object.keys(unblockedProfile).sort(), ["area", "displayName", "id", "record", "sports", "username"]);
  checks++;
  assert.deepEqual(Object.keys(unblockedProfile.record).sort(), ["draws", "losses", "matchesPlayed", "wins"]);
  checks++;
  assert.equal(unblockedProfile.sports[0].skillRating, null);
  ok(await profile(a, a.id), 409);
  ok(await profile(a, randomUUID()), 404);
  checks++;
  assert.ok(ok(await search(a, b.username)).profiles.some((item) => item.id === b.id));
  checks++;
  assert.ok(listIds(ok(await nearby(a)), "players").includes(b.id));

  const pendingAB = ok(await direct(a, b.id), 201).challenge.id;
  const pendingBA = ok(await direct(b, a.id), 201).challenge.id;
  const acceptedId = ok(await direct(a, b.id), 201).challenge.id;
  ok(await edge(b, "respond-to-challenge", { challengeId: acceptedId, action: "accept" }));
  const acceptedRow = await challengeRow(acceptedId);
  checks++;
  assert.equal(acceptedRow.status, "accepted");
  const openB = ok(await edge(b, "create-open-challenge", {
    sport: "pickleball", scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), locationName: "Local Test Court", challengeType: "casual"
  }), 201);
  const openId = openB.challenge?.id ?? openB.id;
  checks++;
  assert.ok(listIds(ok(await open(a)), "challenges").includes(openId));
  const openA = ok(await edge(a, "create-open-challenge", {
    sport: "pickleball", scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), locationName: "Local Test Court", challengeType: "casual"
  }), 201).challenge.id;
  const statsBeforeBlock = ok(await call(`/rest/v1/profile_stats?profile_id=in.(${a.id},${b.id})&select=profile_id,wins,losses,draws,matches_played,xp&order=profile_id`));
  const ratingBeforeBlock = ok(await call("/rest/v1/match_rating_ledger?select=match_id"));
  const xpBeforeBlock = ok(await call("/rest/v1/profile_xp_ledger?select=id"));

  ok(await edge(a, "manage-social", { action: "block", targetProfileId: b.id }));
  for (const id of [pendingAB, pendingBA]) {
    const row = await challengeRow(id);
    checks += 2;
    assert.equal(row.status, "canceled");
    assert.ok(row.canceled_at);
  }
  checks++;
  assert.equal((await challengeRow(acceptedId)).status, "accepted");
  checks++;
  assert.equal((await challengeRow(openId)).status, "pending");
  checks++;
  assert.deepEqual(ok(await call(`/rest/v1/profile_stats?profile_id=in.(${a.id},${b.id})&select=profile_id,wins,losses,draws,matches_played,xp&order=profile_id`)), statsBeforeBlock);
  checks++;
  assert.deepEqual(ok(await call("/rest/v1/match_rating_ledger?select=match_id")), ratingBeforeBlock);
  checks++;
  assert.deepEqual(ok(await call("/rest/v1/profile_xp_ledger?select=id")), xpBeforeBlock);
  ok(await edge(b, "respond-to-challenge", { challengeId: pendingAB, action: "accept" }), 409);
  ok(await edge(a, "respond-to-challenge", { challengeId: pendingAB, action: "cancel" }), 409);

  for (const [actor, target] of [[a, b], [b, a]]) {
    ok(await direct(actor, target.id), 404);
    ok(await generic(actor, target.id), 404);
    const blockedProfile = ok(await profile(actor, target.id), 404);
    checks++;
    assert.deepEqual(blockedProfile, { error: "Profile unavailable" });
    checks++;
    assert.ok(!ok(await search(actor, target.username)).profiles.some((item) => item.id === target.id));
    checks++;
    assert.ok(!listIds(ok(await nearby(actor)), "players").includes(target.id));
  }
  checks++;
  assert.ok(!listIds(ok(await open(a)), "challenges").includes(openId));
  checks++;
  assert.ok(!listIds(ok(await open(b)), "challenges").includes(openA));
  ok(await edge(a, "accept-open-challenge", { challengeId: openId }), 409);
  ok(await edge(b, "accept-open-challenge", { challengeId: openA }), 409);
  checks++;
  assert.equal((await challengeRow(acceptedId)).status, "accepted");
  const acceptedMatch = ok(await call(`/rest/v1/matches?challenge_id=eq.${acceptedId}&select=id`))[0];
  checks++;
  assert.ok(acceptedMatch?.id);
  ok(await edge(a, "submit-match-result", { matchId: acceptedMatch.id, winnerProfileId: a.id, resultOutcome: "win", scoreSummary: "11-7" }));
  ok(await edge(b, "confirm-match-result", { matchId: acceptedMatch.id }));
  checks++;
  assert.equal((await challengeRow(acceptedId)).status, "completed");

  // Unrelated users and normal join path remain available.
  ok(await direct(a, c.id), 201);
  checks++;
  assert.ok(ok(await search(a, unrelated.username)).profiles.some((item) => item.id === unrelated.id));
  checks++;
  assert.ok(listIds(ok(await nearby(a)), "players").includes(c.id));
  checks++;
  assert.ok(listIds(ok(await open(c)), "challenges").includes(openId));
  ok(await edge(c, "accept-open-challenge", { challengeId: openId }));

  ok(await edge(a, "manage-social", { action: "unblock", targetProfileId: b.id }));
  checks++;
  assert.deepEqual(ok(await edge(a, "get-social-relationships", { action: "relationship", targetProfileId: b.id })).data.relationship, { state: "none" });
  const restoredProfile = ok(await profile(a, b.id)).profile;
  const authoritativeStats = ok(await call(`/rest/v1/profile_stats?profile_id=eq.${b.id}&select=wins,losses,draws,matches_played`))[0];
  checks++;
  assert.deepEqual(restoredProfile.record, {
    wins: authoritativeStats.wins, losses: authoritativeStats.losses,
    draws: authoritativeStats.draws, matchesPlayed: authoritativeStats.matches_played
  });
  const authoritativeRating = ok(await call(`/rest/v1/profile_sport_ratings?profile_id=eq.${b.id}&sport_id=eq.3&select=rating,rated_matches_count`))[0];
  checks++;
  assert.equal(restoredProfile.sports[0].skillRating,
    authoritativeRating?.rated_matches_count > 0 ? authoritativeRating.rating : null);
  checks++;
  assert.ok(ok(await search(a, b.username)).profiles.some((item) => item.id === b.id));
  const postUnblock = ok(await direct(b, a.id), 201).challenge.id;
  ok(await generic(a, b.id));
  ok(await edge(b, "respond-to-challenge", { challengeId: postUnblock, action: "cancel" }));
  const declineTarget = ok(await direct(a, b.id), 201).challenge.id;
  ok(await edge(b, "respond-to-challenge", { challengeId: declineTarget, action: "decline" }));
  checks++;
  assert.equal((await challengeRow(pendingAB)).status, "canceled");
  ok(await call(`/rest/v1/profile_sports?profile_id=eq.${c.id}&sport_id=eq.3`, {
    method: "PATCH", prefer: "return=minimal", body: { is_active: false }
  }), 204);
  checks++;
  assert.deepEqual(ok(await profile(a, c.id)).profile.sports, []);
  console.log(`Loop 4.2C block enforcement passed (${checks} assertions).`);
} finally {
  for (const id of users.reverse()) {
    await call(`/auth/v1/admin/users/${id}`, { method: "DELETE" }).catch(() => undefined);
  }
}
