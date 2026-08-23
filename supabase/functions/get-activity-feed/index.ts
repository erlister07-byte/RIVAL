import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");


if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}


const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function isMissingActivityEventsTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = error.message ?? "";

  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("public.activity_events") ||
    message.includes("activity_events") && message.includes("schema cache") ||
    message.includes("relation \"public.activity_events\" does not exist")
  );
}



Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authUserId = await getAuthenticatedUserId(request);
    const requestBody = (await request.json().catch(() => ({}))) as {
      profileId?: string;
      limit?: number;
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profileError) {
      console.error("[get-activity-feed] profile lookup failed", {
        authUserId,
        error: profileError
      });
      return jsonResponse(500, { error: profileError.message });
    }

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for authenticated user" });
    }

    if (typeof requestBody.profileId === "string" && requestBody.profileId !== profile.id) {
      return jsonResponse(403, { error: "Profile mismatch" });
    }

    const limit = Math.min(Math.max(requestBody.limit ?? 25, 1), 100);

    console.log("[get-activity-feed] verified feed request", {
      authUserId,
      profileId: profile.id,
      limit
    });

    const { data: feedRows, error: feedError } = await supabaseAdmin
      .from("activity_events")
      .select("id, actor_profile_id, target_profile_id, challenge_id, match_id, event_type, metadata, created_at, sports(slug)")
      .or(`actor_profile_id.eq.${profile.id},target_profile_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (feedError) {
      if (isMissingActivityEventsTableError(feedError)) {
        console.warn("[get-activity-feed] activity_events table missing; returning empty feed", {
          authUserId,
          profileId: profile.id,
          error: feedError
        });

        return jsonResponse(200, {
          success: true,
          profileId: profile.id,
          feed: []
        });
      }

      console.error("[get-activity-feed] feed query failed", {
        authUserId,
        profileId: profile.id,
        error: feedError
      });
      return jsonResponse(500, { error: feedError.message });
    }

    const feed = (feedRows ?? []).map((row) => ({
      id: row.id,
      actor_profile_id: row.actor_profile_id,
      target_profile_id: row.target_profile_id,
      challenge_id: row.challenge_id,
      match_id: row.match_id,
      sport_slug: row.sports?.slug ?? null,
      event_type: row.event_type,
      metadata: row.metadata,
      created_at: row.created_at
    }));

    console.log("[get-activity-feed] feed load succeeded", {
      authUserId,
      profileId: profile.id,
      rowCount: feed.length
    });

    return jsonResponse(200, {
      success: true,
      profileId: profile.id,
      feed
    });
  } catch (error) {
    console.error("[get-activity-feed] unexpected failure", error);

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown feed error"
    });
  }
});
