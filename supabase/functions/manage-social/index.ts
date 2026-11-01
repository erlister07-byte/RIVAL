import {
  errorResponse,
  getSocialContext,
  jsonResponse,
  readStrictBody,
  requireUuid,
  SocialApiError,
  socialCorsHeaders
} from "../_shared/social-api.ts";

type MutationAction =
  | "send_request"
  | "accept_request"
  | "decline_request"
  | "cancel_request"
  | "remove_friend"
  | "block"
  | "unblock";

const mutationActions = new Set<MutationAction>([
  "send_request",
  "accept_request",
  "decline_request",
  "cancel_request",
  "remove_friend",
  "block",
  "unblock"
]);

function mapDatabaseError(error: { message?: string } | null): never {
  const message = error?.message ?? "";
  if (message === "Friend request cooldown active") {
    throw new SocialApiError(409, "cooldown", "Friend request cooldown active");
  }
  if (message === "Social interaction unavailable" || message === "Target profile unavailable") {
    throw new SocialApiError(404, "not_found_or_unavailable", "Social interaction unavailable");
  }
  if (
    message === "Invalid friend request target" ||
    message === "Invalid friend request" ||
    message === "Invalid block target" ||
    message === "Block unavailable"
  ) {
    throw new SocialApiError(400, "invalid_request", "Invalid social operation");
  }
  if (
    message === "Pending friend request unavailable" ||
    message === "Friendship unavailable"
  ) {
    throw new SocialApiError(409, "unavailable", "Social operation unavailable");
  }
  throw new Error("Trusted social operation failed");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: socialCorsHeaders });
  if (request.method !== "POST") {
    return jsonResponse(405, {
      error: { code: "invalid_request", message: "Method not allowed" }
    });
  }

  try {
    const { admin, authUserId } = await getSocialContext(request);
    const body = await readStrictBody(request, ["action", "targetProfileId"]);
    const action = typeof body.action === "string" ? body.action as MutationAction : "";
    if (!mutationActions.has(action)) {
      throw new SocialApiError(400, "invalid_request", "Invalid social action");
    }
    const targetProfileId = requireUuid(body.targetProfileId);

    if (action === "send_request") {
      const { data, error } = await admin.rpc("social_send_friend_request", {
        trusted_actor_auth_user_id: authUserId,
        target_profile_id: targetProfileId
      });
      if (error) mapDatabaseError(error);
      return jsonResponse(200, { data: { state: data } });
    }

    if (action === "accept_request" || action === "decline_request") {
      const { data, error } = await admin.rpc("social_respond_to_friend_request", {
        trusted_actor_auth_user_id: authUserId,
        requester_profile_id: targetProfileId,
        response_action: action === "accept_request" ? "accept" : "decline"
      });
      if (error) mapDatabaseError(error);
      return jsonResponse(200, { data: { state: data } });
    }

    if (action === "cancel_request") {
      const { data, error } = await admin.rpc("social_cancel_friend_request", {
        trusted_actor_auth_user_id: authUserId,
        target_profile_id: targetProfileId
      });
      if (error) mapDatabaseError(error);
      return jsonResponse(200, { data: { state: data } });
    }

    if (action === "remove_friend") {
      const { data, error } = await admin.rpc("social_remove_friendship", {
        trusted_actor_auth_user_id: authUserId,
        other_profile_id: targetProfileId
      });
      if (error) mapDatabaseError(error);
      return jsonResponse(200, { data: { state: data } });
    }

    if (action === "block") {
      const { error } = await admin.rpc("social_block_profile", {
        trusted_actor_auth_user_id: authUserId,
        target_profile_id: targetProfileId
      });
      if (error) mapDatabaseError(error);
      return jsonResponse(200, { data: { success: true } });
    }

    const { error } = await admin.rpc("social_unblock_profile", {
      trusted_actor_auth_user_id: authUserId,
      target_profile_id: targetProfileId
    });
    if (error) mapDatabaseError(error);
    return jsonResponse(200, { data: { success: true } });
  } catch (error) {
    return errorResponse(error, "manage-social");
  }
});
