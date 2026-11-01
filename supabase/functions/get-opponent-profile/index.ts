import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { isPairBlocked } from "../_shared/block.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  try {
    const authUserId = await getAuthenticatedUserId(request);
    const parameters = new URL(request.url).searchParams;
    const profileId = parameters.get("profileId")?.trim() ?? "";
    if (parameters.size !== 1 || !uuidPattern.test(profileId)) {
      return jsonResponse(400, { error: "Invalid profile ID" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Service configuration unavailable");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: caller, error: callerError } = await admin.from("profiles")
      .select("id").eq("auth_user_id", authUserId).maybeSingle();
    if (callerError) throw callerError;
    if (!caller) return jsonResponse(404, { error: "Profile unavailable" });
    if (caller.id === profileId) return jsonResponse(409, { error: "Open your own Profile tab" });
    if (await isPairBlocked(admin, caller.id, profileId)) return jsonResponse(404, { error: "Profile unavailable" });

    const { data: opponent, error: profileError } = await admin.from("profiles")
      .select("id, username, display_name, vancouver_area")
      .eq("id", profileId).eq("onboarding_completed", true).maybeSingle();
    if (profileError) throw profileError;
    if (!opponent) return jsonResponse(404, { error: "Profile unavailable" });

    const [{ data: sports, error: sportsError }, { data: stats, error: statsError }, { data: ratings, error: ratingsError }] = await Promise.all([
      admin.from("profile_sports").select("sport_id, skill_level, sports(slug)").eq("profile_id", profileId).eq("is_active", true),
      admin.from("profile_stats").select("wins, losses, draws, matches_played").eq("profile_id", profileId).maybeSingle(),
      admin.from("profile_sport_ratings").select("sport_id, rating, rated_matches_count").eq("profile_id", profileId)
    ]);
    if (sportsError || statsError || ratingsError) throw sportsError ?? statsError ?? ratingsError;
    // A missing stats row is an unavailable record, not a confirmed zero record.
    if (!stats) return jsonResponse(503, { error: "Opponent record unavailable" });
    const ratingBySport = new Map((ratings ?? []).map((row) => [row.sport_id, row]));

    return jsonResponse(200, {
      profile: {
        id: opponent.id,
        username: opponent.username,
        displayName: opponent.display_name,
        area: opponent.vancouver_area,
        sports: (sports ?? []).flatMap((row) => {
          const sport = first(row.sports);
          if (!sport?.slug) return [];
          const rating = ratingBySport.get(row.sport_id);
          return [{
            sport: sport.slug,
            selfAssessedSkill: row.skill_level,
            skillRating: rating && rating.rated_matches_count > 0 ? rating.rating : null
          }];
        }),
        record: {
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          matchesPlayed: stats.matches_played
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && /Supabase bearer token|Supabase session/.test(error.message)) {
      return jsonResponse(401, { error: "Authentication required" });
    }
    console.error("[get-opponent-profile] read failed", error);
    return jsonResponse(500, { error: "Unable to load opponent profile" });
  }
});
