import { getAuthenticatedRequestHeaders } from "@/services/authSession";

export type SocialRelationshipState =
  | "none"
  | "outgoing_pending"
  | "incoming_pending"
  | "friends";

export type SocialErrorCode =
  | "unauthenticated"
  | "invalid_request"
  | "not_found_or_unavailable"
  | "cooldown"
  | "unavailable"
  | "internal_error";

export type SocialPublicProfile = {
  id: string;
  username: string;
  displayName: string;
};

export type SocialFriend = { profile: SocialPublicProfile };
export type SocialFriendRequest = {
  profile: SocialPublicProfile;
  requestedAt: string;
};
export type SocialBlockedPlayer = {
  profile: SocialPublicProfile;
  blockedAt: string;
};
export type SocialFriendRequests = {
  incoming: SocialFriendRequest[];
  outgoing: SocialFriendRequest[];
};

export class SocialServiceError extends Error {
  constructor(
    readonly code: SocialErrorCode,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const relationshipStates = new Set<SocialRelationshipState>([
  "none",
  "outgoing_pending",
  "incoming_pending",
  "friends"
]);
const errorCodes = new Set<SocialErrorCode>([
  "unauthenticated",
  "invalid_request",
  "not_found_or_unavailable",
  "cooldown",
  "unavailable",
  "internal_error"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function requireTargetProfileId(targetProfileId: string) {
  if (!uuidPattern.test(targetProfileId)) {
    throw new SocialServiceError("invalid_request", "Invalid target profile", 400);
  }
  return targetProfileId;
}

function parsePublicProfile(value: unknown): SocialPublicProfile {
  if (!isRecord(value) || !hasExactKeys(value, ["id", "username", "displayName"]) ||
    typeof value.id !== "string" || !uuidPattern.test(value.id) ||
    typeof value.username !== "string" || typeof value.displayName !== "string") {
    throw new Error("Invalid social profile response");
  }
  return {
    id: value.id,
    username: value.username,
    displayName: value.displayName
  };
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error("Invalid social timestamp response");
  }
  return value;
}

async function callSocialApi(
  functionName: "get-social-relationships" | "manage-social",
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error("Supabase is not configured");

  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      ...(await getAuthenticatedRequestHeaders()),
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    const code = error && typeof error.code === "string" && errorCodes.has(error.code as SocialErrorCode)
      ? error.code as SocialErrorCode
      : "internal_error";
    const message = error && typeof error.message === "string"
      ? error.message
      : "Social operation unavailable";
    throw new SocialServiceError(code, message, response.status);
  }

  if (!isRecord(payload) || !hasExactKeys(payload, ["data"]) || !isRecord(payload.data)) {
    throw new Error("Invalid social API response");
  }
  return payload.data;
}

export async function getRelationship(
  targetProfileId: string
): Promise<SocialRelationshipState> {
  const data = await callSocialApi("get-social-relationships", {
    action: "relationship",
    targetProfileId: requireTargetProfileId(targetProfileId)
  });
  if (!hasExactKeys(data, ["relationship"]) || !isRecord(data.relationship) ||
    !hasExactKeys(data.relationship, ["state"]) ||
    typeof data.relationship.state !== "string" ||
    !relationshipStates.has(data.relationship.state as SocialRelationshipState)) {
    throw new Error("Invalid relationship response");
  }
  return data.relationship.state as SocialRelationshipState;
}

export async function getFriends(): Promise<SocialFriend[]> {
  const data = await callSocialApi("get-social-relationships", { action: "friends" });
  if (!hasExactKeys(data, ["friends"]) || !Array.isArray(data.friends)) {
    throw new Error("Invalid friends response");
  }
  return data.friends.map((value) => {
    if (!isRecord(value) || !hasExactKeys(value, ["profile"])) {
      throw new Error("Invalid friend response");
    }
    return { profile: parsePublicProfile(value.profile) };
  });
}

export async function getFriendRequests(): Promise<SocialFriendRequests> {
  const data = await callSocialApi("get-social-relationships", { action: "requests" });
  if (!hasExactKeys(data, ["incoming", "outgoing"]) ||
    !Array.isArray(data.incoming) || !Array.isArray(data.outgoing)) {
    throw new Error("Invalid friend requests response");
  }
  const parseRequest = (value: unknown): SocialFriendRequest => {
    if (!isRecord(value) || !hasExactKeys(value, ["profile", "requestedAt"])) {
      throw new Error("Invalid friend request response");
    }
    return {
      profile: parsePublicProfile(value.profile),
      requestedAt: parseTimestamp(value.requestedAt)
    };
  };
  return {
    incoming: data.incoming.map(parseRequest),
    outgoing: data.outgoing.map(parseRequest)
  };
}

export async function getBlockedPlayers(): Promise<SocialBlockedPlayer[]> {
  const data = await callSocialApi("get-social-relationships", { action: "blocked" });
  if (!hasExactKeys(data, ["blocked"]) || !Array.isArray(data.blocked)) {
    throw new Error("Invalid blocked players response");
  }
  return data.blocked.map((value) => {
    if (!isRecord(value) || !hasExactKeys(value, ["profile", "blockedAt"])) {
      throw new Error("Invalid blocked player response");
    }
    return {
      profile: parsePublicProfile(value.profile),
      blockedAt: parseTimestamp(value.blockedAt)
    };
  });
}

async function mutateState(
  action: "send_request" | "accept_request" | "decline_request" | "cancel_request" | "remove_friend",
  targetProfileId: string
): Promise<SocialRelationshipState> {
  const data = await callSocialApi("manage-social", {
    action,
    targetProfileId: requireTargetProfileId(targetProfileId)
  });
  if (!hasExactKeys(data, ["state"]) || typeof data.state !== "string" ||
    !relationshipStates.has(data.state as SocialRelationshipState)) {
    throw new Error("Invalid social mutation response");
  }
  return data.state as SocialRelationshipState;
}

async function mutateSuccess(action: "block" | "unblock", targetProfileId: string) {
  const data = await callSocialApi("manage-social", {
    action,
    targetProfileId: requireTargetProfileId(targetProfileId)
  });
  if (!hasExactKeys(data, ["success"]) || data.success !== true) {
    throw new Error("Invalid social mutation response");
  }
}

export const sendFriendRequest = (targetProfileId: string) =>
  mutateState("send_request", targetProfileId);
export const acceptFriendRequest = (targetProfileId: string) =>
  mutateState("accept_request", targetProfileId);
export const declineFriendRequest = (targetProfileId: string) =>
  mutateState("decline_request", targetProfileId);
export const cancelFriendRequest = (targetProfileId: string) =>
  mutateState("cancel_request", targetProfileId);
export const removeFriend = (targetProfileId: string) =>
  mutateState("remove_friend", targetProfileId);
export const blockPlayer = (targetProfileId: string) =>
  mutateSuccess("block", targetProfileId);
export const unblockPlayer = (targetProfileId: string) =>
  mutateSuccess("unblock", targetProfileId);
