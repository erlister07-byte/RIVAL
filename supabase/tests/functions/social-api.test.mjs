import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

function localSupabaseConfig() {
  const output = execFileSync(
    "npx",
    ["supabase@latest", "status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const jsonStart = output.indexOf("{");
  if (jsonStart < 0) throw new Error("Local Supabase status was unavailable");
  const status = JSON.parse(output.slice(jsonStart));
  return {
    apiUrl: status.API_URL,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY
  };
}

const config = localSupabaseConfig();
const runId = randomUUID().slice(0, 8);
const password = `Local-only-${randomUUID()}!`;
const createdAuthUserIds = [];
let assertionCount = 0;

const forbiddenResponseKeys = new Set([
  "auth_user_id",
  "email",
  "latitude",
  "longitude",
  "coordinates",
  "challenge_radius_km",
  "blocker_profile_id",
  "blocked_profile_id",
  "requested_by_profile_id",
  "profile_a_id",
  "profile_b_id",
  "service_role"
]);

function verifyAllowlist(value) {
  if (Array.isArray(value)) {
    value.forEach(verifyAllowlist);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!forbiddenResponseKeys.has(key), `response leaked forbidden key ${key}`);
    verifyAllowlist(child);
  }
}

async function request(path, { method = "GET", key, token, body, headers = {} } = {}) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      ...(key ? { apikey: key } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (payload && path.startsWith("/functions/v1/")) verifyAllowlist(payload);
  return { status: response.status, payload };
}

async function adminRequest(path, { method = "GET", body, prefer } = {}) {
  const result = await request(path, {
    method,
    key: config.serviceRoleKey,
    token: config.serviceRoleKey,
    body,
    headers: prefer ? { Prefer: prefer } : {}
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Local fixture request failed with ${result.status}`);
  }
  return result.payload;
}

async function createFixture(label, onboardingCompleted = true) {
  const email = `loop42b-${runId}-${label}@rival.local`;
  const authPayload = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: { email, password, email_confirm: true }
  });
  const authUserId = authPayload.id;
  createdAuthUserIds.push(authUserId);
  const profileId = randomUUID();
  await adminRequest("/rest/v1/profiles", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      id: profileId,
      auth_user_id: authUserId,
      email,
      username: `loop42b_${runId}_${label}`,
      display_name: `Loop 4.2B ${label.toUpperCase()}`,
      vancouver_area: "Downtown",
      onboarding_completed: onboardingCompleted
    }
  });
  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    key: config.anonKey,
    body: { email, password }
  });
  assert.equal(session.status, 200);
  return {
    authUserId,
    profileId,
    token: session.payload.access_token,
    username: `loop42b_${runId}_${label}`,
    displayName: `Loop 4.2B ${label.toUpperCase()}`
  };
}

async function socialRead(token, action, targetProfileId) {
  return request("/functions/v1/get-social-relationships", {
    method: "POST",
    key: config.anonKey,
    token,
    body: targetProfileId ? { action, targetProfileId } : { action }
  });
}

async function socialMutation(token, action, targetProfileId, extra = {}) {
  return request("/functions/v1/manage-social", {
    method: "POST",
    key: config.anonKey,
    token,
    body: { action, targetProfileId, ...extra }
  });
}

function expectStatus(result, status) {
  assertionCount += 1;
  assert.equal(result.status, status, JSON.stringify(result.payload));
}

function expectState(result, state) {
  expectStatus(result, 200);
  assertionCount += 1;
  assert.deepEqual(result.payload, { data: { state } });
}

function expectRelationship(result, state) {
  expectStatus(result, 200);
  assertionCount += 1;
  assert.deepEqual(result.payload, { data: { relationship: { state } } });
}

function expectError(result, status, code) {
  expectStatus(result, status);
  assertionCount += 1;
  assert.equal(result.payload?.error?.code, code);
  assertionCount += 1;
  assert.deepEqual(Object.keys(result.payload?.error ?? {}).sort(), ["code", "message"]);
}

async function ageDeclinedRelationship(firstProfileId, secondProfileId) {
  const [profileA, profileB] = [firstProfileId, secondProfileId].sort();
  const now = Date.now();
  await adminRequest(
    `/rest/v1/friend_relationships?profile_a_id=eq.${profileA}&profile_b_id=eq.${profileB}`,
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        requested_at: new Date(now - 9 * 86_400_000).toISOString(),
        responded_at: new Date(now - 8 * 86_400_000).toISOString(),
        ended_at: new Date(now - 8 * 86_400_000).toISOString(),
        updated_at: new Date(now - 8 * 86_400_000).toISOString()
      }
    }
  );
}

async function run() {
  const [a, b, c, d, unavailable] = await Promise.all([
    createFixture("a"),
    createFixture("b"),
    createFixture("c"),
    createFixture("d"),
    createFixture("unavailable", false)
  ]);

  expectError(await request("/functions/v1/get-social-relationships", {
    method: "POST",
    key: config.anonKey,
    body: { action: "friends" }
  }), 401, "unauthenticated");
  expectStatus(await request("/functions/v1/get-social-relationships", {
    method: "POST",
    key: config.anonKey,
    token: "not-a-valid-jwt",
    body: { action: "friends" }
  }), 401);
  expectError(await socialRead(unavailable.token, "friends"), 404, "not_found_or_unavailable");

  expectError(await socialMutation(a.token, "send_request", b.profileId, {
    authUserId: b.authUserId
  }), 400, "invalid_request");
  expectError(await socialMutation(a.token, "send_request", a.profileId), 400, "invalid_request");
  expectError(await socialMutation(a.token, "block", a.profileId), 400, "invalid_request");
  expectRelationship(await socialRead(a.token, "relationship", b.profileId), "none");

  expectState(await socialMutation(a.token, "send_request", b.profileId), "outgoing_pending");
  expectRelationship(await socialRead(a.token, "relationship", b.profileId), "outgoing_pending");
  expectRelationship(await socialRead(b.token, "relationship", a.profileId), "incoming_pending");
  expectState(await socialMutation(a.token, "send_request", b.profileId), "outgoing_pending");
  expectError(await socialMutation(c.token, "accept_request", a.profileId), 409, "unavailable");
  expectError(await socialMutation(b.token, "cancel_request", a.profileId), 409, "unavailable");
  expectState(await socialMutation(a.token, "cancel_request", b.profileId), "none");

  expectState(await socialMutation(a.token, "send_request", b.profileId), "outgoing_pending");
  expectState(await socialMutation(b.token, "decline_request", a.profileId), "none");
  const declinedRequests = await socialRead(a.token, "requests");
  expectStatus(declinedRequests, 200);
  assertionCount += 1;
  assert.deepEqual(declinedRequests.payload.data, { incoming: [], outgoing: [] });
  expectError(await socialMutation(a.token, "send_request", b.profileId), 409, "cooldown");
  await ageDeclinedRelationship(a.profileId, b.profileId);
  expectState(await socialMutation(a.token, "send_request", b.profileId), "outgoing_pending");
  expectState(await socialMutation(b.token, "accept_request", a.profileId), "friends");
  expectRelationship(await socialRead(a.token, "relationship", b.profileId), "friends");
  expectState(await socialMutation(b.token, "remove_friend", a.profileId), "none");
  expectRelationship(await socialRead(a.token, "relationship", b.profileId), "none");

  expectState(await socialMutation(a.token, "send_request", b.profileId), "outgoing_pending");
  expectState(await socialMutation(b.token, "send_request", a.profileId), "friends");
  expectState(await socialMutation(a.token, "remove_friend", b.profileId), "none");

  expectState(await socialMutation(a.token, "send_request", c.profileId), "outgoing_pending");
  expectState(await socialMutation(d.token, "send_request", a.profileId), "outgoing_pending");
  expectState(await socialMutation(c.token, "send_request", d.profileId), "outgoing_pending");
  expectState(await socialMutation(d.token, "decline_request", c.profileId), "none");

  const aRequests = await socialRead(a.token, "requests");
  expectStatus(aRequests, 200);
  assertionCount += 4;
  assert.deepEqual(aRequests.payload.data.outgoing.map((item) => item.profile.id), [c.profileId]);
  assert.deepEqual(aRequests.payload.data.incoming.map((item) => item.profile.id), [d.profileId]);
  assert.deepEqual(Object.keys(aRequests.payload.data.outgoing[0]).sort(), ["profile", "requestedAt"]);
  assert.deepEqual(Object.keys(aRequests.payload.data.outgoing[0].profile).sort(), ["displayName", "id", "username"]);

  expectState(await socialMutation(c.token, "accept_request", a.profileId), "friends");
  const aFriends = await socialRead(a.token, "friends");
  expectStatus(aFriends, 200);
  assertionCount += 2;
  assert.deepEqual(aFriends.payload.data.friends.map((item) => item.profile.id), [c.profileId]);
  assert.deepEqual(Object.keys(aFriends.payload.data.friends[0].profile).sort(), ["displayName", "id", "username"]);
  expectState(await socialMutation(a.token, "remove_friend", c.profileId), "none");
  expectState(await socialMutation(d.token, "cancel_request", a.profileId), "none");
  const emptyRequests = await socialRead(a.token, "requests");
  expectStatus(emptyRequests, 200);
  assertionCount += 1;
  assert.deepEqual(emptyRequests.payload.data, { incoming: [], outgoing: [] });

  expectState(await socialMutation(a.token, "send_request", b.profileId), "outgoing_pending");
  expectState(await socialMutation(b.token, "send_request", a.profileId), "friends");
  expectStatus(await socialMutation(a.token, "block", b.profileId), 200);
  expectStatus(await socialMutation(a.token, "block", b.profileId), 200);
  const blockedFromA = await socialRead(a.token, "relationship", b.profileId);
  const blockedFromB = await socialRead(b.token, "relationship", a.profileId);
  expectError(blockedFromA, 404, "not_found_or_unavailable");
  expectError(blockedFromB, 404, "not_found_or_unavailable");
  assertionCount += 1;
  assert.deepEqual(blockedFromA.payload, blockedFromB.payload);
  expectError(await socialMutation(a.token, "send_request", b.profileId), 404, "not_found_or_unavailable");
  expectError(await socialMutation(b.token, "send_request", a.profileId), 404, "not_found_or_unavailable");

  const aBlocked = await socialRead(a.token, "blocked");
  const bBlocked = await socialRead(b.token, "blocked");
  expectStatus(aBlocked, 200);
  expectStatus(bBlocked, 200);
  assertionCount += 4;
  assert.deepEqual(aBlocked.payload.data.blocked.map((item) => item.profile.id), [b.profileId]);
  assert.deepEqual(bBlocked.payload.data.blocked, []);
  assert.deepEqual(Object.keys(aBlocked.payload.data.blocked[0]).sort(), ["blockedAt", "profile"]);
  assert.deepEqual(Object.keys(aBlocked.payload.data.blocked[0].profile).sort(), ["displayName", "id", "username"]);

  expectStatus(await socialMutation(b.token, "unblock", a.profileId), 200);
  expectError(await socialRead(a.token, "relationship", b.profileId), 404, "not_found_or_unavailable");
  expectStatus(await socialMutation(a.token, "unblock", b.profileId), 200);
  expectRelationship(await socialRead(a.token, "relationship", b.profileId), "none");

  expectState(await socialMutation(a.token, "send_request", b.profileId), "outgoing_pending");
  expectStatus(await socialMutation(b.token, "block", a.profileId), 200);
  expectError(await socialRead(a.token, "relationship", b.profileId), 404, "not_found_or_unavailable");
  expectStatus(await socialMutation(b.token, "unblock", a.profileId), 200);
  expectRelationship(await socialRead(a.token, "relationship", b.profileId), "none");

  console.log(`Loop 4.2B social API integration tests passed (${assertionCount} assertions).`);
}

try {
  await run();
} finally {
  for (const authUserId of createdAuthUserIds.reverse()) {
    await adminRequest(`/auth/v1/admin/users/${authUserId}`, { method: "DELETE" }).catch(() => undefined);
  }
}
