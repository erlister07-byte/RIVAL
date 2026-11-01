import {
  errorResponse,
  getSocialContext,
  jsonResponse,
  publicProfile,
  requireExactKeys,
  requireUuid,
  SocialApiError,
  socialCorsHeaders,
  unavailableRelationship
} from "../_shared/social-api.ts";

type ReadAction = "relationship" | "friends" | "requests" | "blocked";
type ProfileRow = { id: string; username: string; display_name: string };
type RelationshipRow = {
  profile_a_id: string;
  profile_b_id: string;
  requested_by_profile_id: string;
  status: "pending" | "accepted" | "declined" | "removed";
  requested_at: string;
};

const readActions = new Set<ReadAction>(["relationship", "friends", "requests", "blocked"]);

async function loadProfiles(
  admin: Awaited<ReturnType<typeof getSocialContext>>["admin"],
  profileIds: string[]
) {
  const uniqueIds = [...new Set(profileIds)];
  if (uniqueIds.length === 0) return new Map<string, ProfileRow>();

  const profiles = new Map<string, ProfileRow>();
  // Bound the IN transport, then keyset-page until empty. A successful short
  // page may reflect a lower server cap, so length is not an end-of-list signal.
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const ids = uniqueIds.slice(offset, offset + 100);
    let cursor: string | undefined;
    while (true) {
      let query = admin.from("profiles").select("id, username, display_name")
        .in("id", ids).order("id", { ascending: true }).limit(100);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw new Error("Unable to load social profiles");
      const page = (data ?? []) as ProfileRow[];
      if (page.length === 0) break;
      for (const profile of page) profiles.set(profile.id, profile);
      cursor = page[page.length - 1].id;
    }
  }
  return profiles;
}

function counterpart(row: RelationshipRow, callerProfileId: string) {
  return row.profile_a_id === callerProfileId ? row.profile_b_id : row.profile_a_id;
}

function byDisplayName(
  left: { profile: { displayName: string; username: string } },
  right: { profile: { displayName: string; username: string } }
) {
  return left.profile.displayName.localeCompare(right.profile.displayName) ||
    left.profile.username.localeCompare(right.profile.username);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: socialCorsHeaders });
  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: { code: "invalid_request", message: "Method not allowed" }
    });
  }

  try {
    const { admin, profileId } = await getSocialContext(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SocialApiError(400, "invalid_request", "Invalid request");
    }
    const record = body as Record<string, unknown>;
    const action = typeof record.action === "string" ? record.action as ReadAction : "";
    if (!readActions.has(action)) {
      throw new SocialApiError(400, "invalid_request", "Invalid social read action");
    }
    requireExactKeys(record, action === "relationship" ? ["action", "targetProfileId"] : ["action"]);

    if (action === "relationship") {
      const targetProfileId = requireUuid(record.targetProfileId);
      if (targetProfileId === profileId) throw unavailableRelationship();

      const { data: blocked, error: blockedError } = await admin.rpc("social_pair_is_blocked", {
        first_profile_id: profileId,
        second_profile_id: targetProfileId
      });
      if (blockedError) throw new Error("Unable to verify relationship availability");
      if (blocked) throw unavailableRelationship();

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", targetProfileId)
        .eq("onboarding_completed", true)
        .maybeSingle();
      if (targetError) throw new Error("Unable to verify target profile");
      if (!target) throw unavailableRelationship();

      const pairA = profileId < targetProfileId ? profileId : targetProfileId;
      const pairB = profileId < targetProfileId ? targetProfileId : profileId;
      const { data: relationship, error: relationshipError } = await admin
        .from("friend_relationships")
        .select("requested_by_profile_id, status")
        .eq("profile_a_id", pairA)
        .eq("profile_b_id", pairB)
        .maybeSingle();
      if (relationshipError) throw new Error("Unable to load relationship");

      let state = "none";
      if (relationship?.status === "accepted") state = "friends";
      if (relationship?.status === "pending") {
        state = relationship.requested_by_profile_id === profileId
          ? "outgoing_pending"
          : "incoming_pending";
      }

      return jsonResponse(200, { data: { relationship: { state } } });
    }

    if (action === "blocked") {
      const blocks: Array<{ blocked_profile_id: string; created_at: string }> = [];
      let cursor: string | undefined;
      while (true) {
        let query = admin.from("profile_blocks").select("blocked_profile_id, created_at")
          .eq("blocker_profile_id", profileId)
          .order("blocked_profile_id", { ascending: true }).limit(100);
        if (cursor) query = query.gt("blocked_profile_id", cursor);
        const { data, error } = await query;
        if (error) throw new Error("Unable to load blocked players");
        const page = data ?? [];
        if (page.length === 0) break;
        blocks.push(...page);
        cursor = page[page.length - 1].blocked_profile_id;
      }
      blocks.sort((left, right) => right.created_at.localeCompare(left.created_at));
      const profiles = await loadProfiles(admin, blocks.map((row) => row.blocked_profile_id));
      const blocked = blocks.flatMap((row) => {
        const profile = profiles.get(row.blocked_profile_id);
        return profile ? [{ profile: publicProfile(profile), blockedAt: row.created_at }] : [];
      });
      return jsonResponse(200, { data: { blocked } });
    }

    const { data: rawRows, error } = await admin
      .from("friend_relationships")
      .select("profile_a_id, profile_b_id, requested_by_profile_id, status, requested_at")
      .or(`profile_a_id.eq.${profileId},profile_b_id.eq.${profileId}`)
      .in("status", action === "friends" ? ["accepted"] : ["pending"]);
    if (error) throw new Error("Unable to load social relationships");

    const rows = (rawRows ?? []) as RelationshipRow[];
    const profiles = await loadProfiles(admin, rows.map((row) => counterpart(row, profileId)));

    if (action === "friends") {
      const friends = rows.flatMap((row) => {
        const profile = profiles.get(counterpart(row, profileId));
        return profile ? [{ profile: publicProfile(profile) }] : [];
      }).sort(byDisplayName);
      return jsonResponse(200, { data: { friends } });
    }

    const incoming: Array<{ profile: ReturnType<typeof publicProfile>; requestedAt: string }> = [];
    const outgoing: Array<{ profile: ReturnType<typeof publicProfile>; requestedAt: string }> = [];
    for (const row of rows) {
      const profile = profiles.get(counterpart(row, profileId));
      if (!profile) continue;
      const item = { profile: publicProfile(profile), requestedAt: row.requested_at };
      (row.requested_by_profile_id === profileId ? outgoing : incoming).push(item);
    }
    incoming.sort(byDisplayName);
    outgoing.sort(byDisplayName);
    return jsonResponse(200, { data: { incoming, outgoing } });
  } catch (error) {
    return errorResponse(error, "get-social-relationships");
  }
});
