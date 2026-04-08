import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

async function verifyFirebaseToken(authorizationHeader: string | null) {
  if (!firebaseProjectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID");
  }

  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Firebase bearer token");
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();
  const firebaseJwks = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
  );

  const { payload } = await jwtVerify(token, firebaseJwks, {
    issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    audience: firebaseProjectId
  });

  return payload;
}

function getFirebaseUid(payload: JWTPayload) {
  if (typeof payload.user_id === "string") {
    return payload.user_id;
  }

  if (typeof payload.sub === "string") {
    return payload.sub;
  }

  throw new Error("Firebase token missing user id");
}

function createSupabaseAdmin() {
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

type ChallengeRow = {
  id: string;
  challenger_profile_id: string;
  sport_id: number;
  scheduled_at: string;
  location_name: string;
  challenge_type: "casual" | "practice" | "ranked";
  stake_note: string | null;
  created_at: string;
  sports: {
    id: number;
    slug: string;
    name: string;
  } | null;
  challenger: {
    id: string;
    username: string;
    display_name: string;
    vancouver_area: string;
  } | null;
  challenger_stats:
    | {
        matches_played: number | null;
      }
    | Array<{
        matches_played: number | null;
      }>
    | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const payload = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = getFirebaseUid(payload);
    const supabaseAdmin = createSupabaseAdmin();
    const requestBody = (await request.json().catch(() => ({}))) as {
      sportId?: number | null;
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, firebase_uid, vancouver_area")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (profileError) {
      return jsonResponse(500, { error: profileError.message });
    }

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for Firebase user" });
    }

    let query = supabaseAdmin
      .from("challenges")
      .select(`
        id,
        challenger_profile_id,
        sport_id,
        scheduled_at,
        location_name,
        challenge_type,
        stake_note,
        created_at,
        sports!inner(id, slug, name),
        challenger:profiles!challenges_challenger_profile_id_fkey(id, username, display_name, vancouver_area),
        challenger_stats:profile_stats!left(matches_played)
      `)
      .eq("is_open", true)
      .eq("status", "pending")
      .is("opponent_profile_id", null)
      .neq("challenger_profile_id", profile.id)
      .gt("scheduled_at", new Date().toISOString());

    if (typeof requestBody.sportId === "number") {
      query = query.eq("sport_id", requestBody.sportId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return jsonResponse(500, { error: error.message });
    }

    const challenges = ((data ?? []) as ChallengeRow[])
      .map((row) => {
        const matchesPlayed = Array.isArray(row.challenger_stats)
          ? row.challenger_stats[0]?.matches_played ?? 0
          : row.challenger_stats?.matches_played ?? 0;

        return {
          challenge_id: row.id,
          challenger_profile_id: row.challenger_profile_id,
          challenger_username: row.challenger?.username ?? "player",
          challenger_display_name: row.challenger?.display_name ?? "Player",
          challenger_area: row.challenger?.vancouver_area ?? "Vancouver",
          sport_id: row.sport_id,
          sport_slug: row.sports?.slug ?? "pickleball",
          sport_name: row.sports?.name ?? "Sport",
          scheduled_at: row.scheduled_at,
          location_name: row.location_name,
          challenge_type: row.challenge_type,
          stake_note: row.stake_note,
          created_at: row.created_at,
          matches_played: matchesPlayed
        };
      })
      .sort((left, right) => {
        const leftAreaRank = left.challenger_area === profile.vancouver_area ? 0 : 1;
        const rightAreaRank = right.challenger_area === profile.vancouver_area ? 0 : 1;

        if (leftAreaRank !== rightAreaRank) {
          return leftAreaRank - rightAreaRank;
        }

        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });

    return jsonResponse(200, {
      success: true,
      challenges
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown get open challenges error"
    });
  }
});
