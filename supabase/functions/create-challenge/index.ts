import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { isPairBlocked } from "../_shared/block.ts";
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
    let authUserId: string;
    try { authUserId = await getAuthenticatedUserId(request); }
    catch { return jsonResponse(401, { error: "Authentication required" }); }
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
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const optionalText = (value: unknown) => value == null || typeof value === "string";
    const coordinate = (value: unknown, max: number) => value == null ||
      (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= max);
    if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody) ||
      !Number.isInteger(requestBody.sportId) || (requestBody.sportId ?? 0) <= 0 ||
      typeof requestBody.scheduledAt !== "string" || Number.isNaN(Date.parse(requestBody.scheduledAt)) ||
      typeof requestBody.locationName !== "string" || !requestBody.locationName.trim() ||
      !["casual", "practice", "ranked"].includes(requestBody.challengeType ?? "") ||
      (requestBody.isOpen !== undefined && typeof requestBody.isOpen !== "boolean") ||
      (requestBody.opponentProfileId != null && (typeof requestBody.opponentProfileId !== "string" || !uuid.test(requestBody.opponentProfileId))) ||
      !optionalText(requestBody.stakeType) || !optionalText(requestBody.stakeLabel) || !optionalText(requestBody.stakeNote) ||
      !coordinate(requestBody.locationLatitude, 90) || !coordinate(requestBody.locationLongitude, 180)) {
      return jsonResponse(400, { error: "Missing or invalid challenge fields" });
    }
    const supabaseAdmin = createSupabaseAdmin();
    const { data: challenger, error: challengerError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("onboarding_completed", true)
      .maybeSingle();

    if (challengerError) {
      return jsonResponse(500, { error: "Unable to create challenge" });
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
        return jsonResponse(500, { error: "Unable to create challenge" });
      }

      if (!opponent) {
        return jsonResponse(404, { error: "Opponent profile not found" });
      }
      if (await isPairBlocked(supabaseAdmin, challenger.id, opponent.id)) {
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
      if (createError.code === "P0001") return jsonResponse(404, { error: "Opponent profile not found" });
      if (["22P02", "22003", "22007", "23503", "23514", "23502"].includes(createError.code)) {
        return jsonResponse(400, { error: "Missing or invalid challenge fields" });
      }
      console.error("[create-challenge] insert failed", { code: createError.code });
      return jsonResponse(500, { error: "Unable to create challenge" });
    }

    return jsonResponse(200, { challenge });
  } catch (error) {
    console.error("[create-challenge] unexpected failure");
    return jsonResponse(500, {
      error: "Unable to create challenge"
    });
  }
});
