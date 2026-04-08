import { ActivityEvent, ActivityEventType, ActivityFeedItem, SportSlug } from "@/core/types/models";
import { firebaseAuth } from "@/services/firebase";
import { Database, Json } from "@/types/database";
import { debugError, debugLog, getSafeErrorPayload } from "@/shared/lib/logger";
import { toServiceError } from "@/shared/lib/serviceError";

import { supabase } from "./supabaseClient";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type ActivityEventFeedRow = Omit<ActivityEventRow, "sport_id"> & {
  sport_slug: SportSlug | null;
};

type ActivityFeedFunctionRow = ActivityEventFeedRow;

type FeedOptions = {
  limit?: number;
};

export type CreateActivityEventInput = {
  actorProfileId: string;
  targetProfileId?: string | null;
  challengeId?: string | null;
  matchId?: string | null;
  sportId?: number | null;
  eventType: ActivityEventType;
  metadata?: Json;
};

function mapActivityEvent(row: ActivityEventFeedRow): ActivityEvent {
  return {
    id: row.id,
    actorProfileId: row.actor_profile_id,
    targetProfileId: row.target_profile_id ?? undefined,
    challengeId: row.challenge_id ?? undefined,
    matchId: row.match_id ?? undefined,
    sport: row.sport_slug ?? undefined,
    eventType: row.event_type as ActivityEventType,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at
  };
}

export async function createActivityEvent(input: CreateActivityEventInput): Promise<void> {
  debugLog("[activityService] creating activity event", {
    actorProfileId: input.actorProfileId,
    targetProfileId: input.targetProfileId ?? null,
    challengeId: input.challengeId ?? null,
    matchId: input.matchId ?? null,
    eventType: input.eventType
  });

  const { error } = await supabase.rpc("insert_activity_event", {
    actor_profile_id_param: input.actorProfileId,
    target_profile_id_param: input.targetProfileId ?? null,
    challenge_id_param: input.challengeId ?? null,
    match_id_param: input.matchId ?? null,
    sport_id_param: input.sportId ?? null,
    event_type_param: input.eventType,
    metadata_param: input.metadata ?? {}
  });

  if (error) {
    debugError("[activityService] failed to create activity event", error, {
      actorProfileId: input.actorProfileId,
      targetProfileId: input.targetProfileId ?? null,
      challengeId: input.challengeId ?? null,
      matchId: input.matchId ?? null,
      eventType: input.eventType
    });
    throw error;
  }
}

export function formatActivityFeedItem(event: ActivityEvent, currentProfileId?: string): ActivityFeedItem {
  const metadata = event.metadata as Record<string, string | undefined>;
  const actorDisplayName = metadata.actor_display_name ?? "Player";
  const targetDisplayName = metadata.target_display_name ?? "Player";
  const opponentDisplayName = metadata.opponent_display_name ?? targetDisplayName;
  const sportLabel =
    metadata.sport_name ?? (event.sport ? event.sport.charAt(0).toUpperCase() + event.sport.slice(1) : undefined);

  let message = "";
  let title: string | undefined;

  if (event.eventType === "challenge_created") {
    message = `${actorDisplayName} challenged ${targetDisplayName}${sportLabel ? ` in ${sportLabel}` : ""}`;
  } else if (event.eventType === "challenge_accepted") {
    message = `${actorDisplayName} accepted a challenge${sportLabel ? ` in ${sportLabel}` : ""}`;
  } else {
    const isViewerWinner = Boolean(currentProfileId) && event.actorProfileId === currentProfileId;
    const isViewerLoser = Boolean(currentProfileId) && event.targetProfileId === currentProfileId;

    if (isViewerWinner) {
      title = "Win";
      message = `You beat ${opponentDisplayName}${sportLabel ? ` in ${sportLabel}` : ""}`;
    } else if (isViewerLoser) {
      title = "Loss";
      message = `You lost to ${actorDisplayName}${sportLabel ? ` in ${sportLabel}` : ""}`;
    } else {
      message = `${actorDisplayName} beat ${targetDisplayName}${sportLabel ? ` in ${sportLabel}` : ""}`;
    }
  }

  return {
    id: event.id,
    actorDisplayName,
    title,
    message,
    sportLabel,
    createdAt: event.createdAt,
    score: metadata.score,
    locationName: metadata.challenge_location,
    eventType: event.eventType
  };
}

export async function getActivityFeed(
  profileId: string,
  options: FeedOptions = {}
): Promise<ActivityFeedItem[]> {
  let functionUrl: string | null = null;
  console.log("[activityService] EDGE FUNCTION PATH ACTIVE");
  debugLog("[activityService] loading activity feed", {
    profileId,
    limit: options.limit ?? 25
  });

  try {
    const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const currentFirebaseUser = firebaseAuth.currentUser;

    if (!supabaseProjectUrl) {
      throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
    }

    if (!supabaseAnonKey) {
      throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY");
    }

    if (!currentFirebaseUser) {
      throw new Error("You need to be signed in to load your activity.");
    }

    const firebaseIdToken = await currentFirebaseUser.getIdToken();
    functionUrl = `${supabaseProjectUrl}/functions/v1/get-activity-feed`;

    console.log("[activityService] edge function request", {
      functionUrl,
      profileId,
      timestamp: new Date().toISOString()
    });
    console.log("[activityService] using edge function feed path", {
      functionUrl,
      profileId,
      limit: options.limit ?? 25,
      hasFirebaseUser: Boolean(currentFirebaseUser.uid),
      firebaseUid: currentFirebaseUser.uid
    });
    debugLog("[activityService] using edge function feed path", {
      functionUrl,
      profileId,
      limit: options.limit ?? 25,
      hasFirebaseUser: Boolean(currentFirebaseUser.uid),
      firebaseUid: currentFirebaseUser.uid
    });

    const feedResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseIdToken}`,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        profileId,
        limit: options.limit ?? 25
      })
    });

    let feedPayload: {
      error?: string;
      feed?: ActivityFeedFunctionRow[];
    } | null = null;

    try {
      feedPayload = (await feedResponse.json()) as {
        error?: string;
        feed?: ActivityFeedFunctionRow[];
      };
    } catch {
      feedPayload = null;
    }

    debugLog("[activityService] activity feed response", {
      profileId,
      functionUrl,
      rowCount: feedPayload?.feed?.length ?? 0,
      status: feedResponse.status,
      ok: feedResponse.ok,
      error: !feedResponse.ok ? feedPayload?.error ?? "Unknown feed error" : null
    });

    if (!feedResponse.ok) {
      throw new Error(feedPayload?.error ?? `Activity feed failed with status ${feedResponse.status}`);
    }

    return (feedPayload?.feed ?? [])
      .map((row) => mapActivityEvent(row))
      .map((event) => formatActivityFeedItem(event, profileId));
  } catch (error) {
    console.error("[activityService] activity feed fetch failed", {
      profileId,
      functionUrl,
      limit: options.limit ?? 25,
      error
    });
    debugError("[activityService] failed to load activity feed", error, {
      profileId,
      functionUrl,
      limit: options.limit ?? 25
    });
    throw toServiceError(error, "Unable to load activity feed right now.");
  }
}

export const getActivityFeedForProfile = getActivityFeed;
