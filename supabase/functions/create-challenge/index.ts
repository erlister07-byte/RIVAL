import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}



function createSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase server configuration is missing");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
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
      sportId?: number;
      opponentProfileId?: string;
      scheduledAt?: string;
      locationName?: string;
      locationLatitude?: number | null;
      locationLongitude?: number | null;
      challengeType?: "casual" | "practice" | "ranked";
      stakeType?: string | null;
      stakeLabel?: string | null;
      stakeNote?: string | null;
      isOpen?: boolean;
    };
    const supabaseAdmin = createSupabaseAdmin();
    const { data: challenger, error: challengerError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("onboarding_completed", true)
      .maybeSingle();

    if (challengerError) {
      return jsonResponse(500, { error: challengerError.message });
    }

    if (!challenger) {
      return jsonResponse(404, { error: "Completed challenger profile not found" });
    }

    const locationName = requestBody.locationName?.trim() ?? "";
    const isOpen = requestBody.isOpen === true;

    if (
      typeof requestBody.sportId !== "number" ||
      !requestBody.scheduledAt ||
      Number.isNaN(Date.parse(requestBody.scheduledAt)) ||
      !locationName ||
      !requestBody.challengeType
    ) {
      return jsonResponse(400, { error: "Missing or invalid challenge fields" });
    }

    if (!isOpen && !requestBody.opponentProfileId) {
      return jsonResponse(400, { error: "Select an opponent first" });
    }

    if (requestBody.opponentProfileId === challenger.id) {
      return jsonResponse(400, { error: "You cannot challenge yourself" });
    }

    if (!isOpen && requestBody.opponentProfileId) {
      const { data: opponent, error: opponentError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", requestBody.opponentProfileId)
        .eq("onboarding_completed", true)
        .maybeSingle();

      if (opponentError) {
        return jsonResponse(500, { error: opponentError.message });
      }

      if (!opponent) {
        return jsonResponse(404, { error: "Opponent profile not found" });
      }
    }

    const { data: challenge, error: createError } = await supabaseAdmin
      .from("challenges")
      .insert({
        sport_id: requestBody.sportId,
        challenger_profile_id: challenger.id,
        opponent_profile_id: isOpen ? null : requestBody.opponentProfileId,
        scheduled_at: requestBody.scheduledAt,
        location_name: locationName,
        location_latitude: requestBody.locationLatitude ?? null,
        location_longitude: requestBody.locationLongitude ?? null,
        challenge_type: requestBody.challengeType,
        stake_type: requestBody.stakeType?.trim() || "bragging_rights",
        stake_label: requestBody.stakeLabel?.trim() || "Bragging Rights",
        stake_note: requestBody.stakeNote?.trim() || null,
        status: "pending",
        is_open: isOpen
      })
      .select("*, sports(*)")
      .single();

    if (createError) {
      console.error("[create-challenge] insert failed", {
        authUserId,
        challengerProfileId: challenger.id,
        opponentProfileId: requestBody.opponentProfileId ?? null,
        error: createError
      });
      return jsonResponse(500, { error: createError.message });
    }

    return jsonResponse(200, { challenge });
  } catch (error) {
    console.error("[create-challenge] unexpected failure", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown challenge creation error"
    });
  }
});
