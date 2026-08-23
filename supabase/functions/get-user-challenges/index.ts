import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const firebaseJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
function jsonResponse(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
async function verifyFirebaseToken(header: string | null) { if (!firebaseProjectId || !header?.startsWith("Bearer ")) return null; try { return (await jwtVerify(header.slice(7).trim(), firebaseJwks, { issuer: `https://securetoken.google.com/${firebaseProjectId}`, audience: firebaseProjectId })).payload; } catch { return null; } }
function getFirebaseUid(payload: JWTPayload) { return typeof payload.user_id === "string" ? payload.user_id : typeof payload.sub === "string" ? payload.sub : null; }
function admin() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration"); return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  try {
    const claims = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = claims ? getFirebaseUid(claims) : null;
    if (!firebaseUid) return jsonResponse(401, { error: "Unauthorized" });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (Object.keys(body).length > 0) return jsonResponse(400, { error: "This request does not accept filters" });
    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin.from("profiles").select("id").eq("firebase_uid", firebaseUid).maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for Firebase user" });
    const { data: rows, error } = await supabaseAdmin.from("challenges").select("id, challenger_profile_id, opponent_profile_id, scheduled_at, location_name, challenge_type, stake_type, stake_label, stake_note, status, created_at, is_open, sports!inner(slug), challenger:profiles!challenges_challenger_profile_id_fkey(username, display_name), opponent:profiles!challenges_opponent_profile_id_fkey(username, display_name)").or(`challenger_profile_id.eq.${caller.id},opponent_profile_id.eq.${caller.id}`).order("created_at", { ascending: false });
    if (error) return jsonResponse(500, { error: "Unable to load challenges" });
    const challenges = (rows ?? []).filter((row) => !row.is_open).map((row) => {
      const outgoing = row.challenger_profile_id === caller.id;
      const counterpart = (outgoing ? row.opponent : row.challenger) as { username: string | null; display_name: string } | null;
      const sport = Array.isArray(row.sports) ? row.sports[0] : row.sports;
      return { id: row.id, direction: outgoing ? "outgoing" : "incoming", opponent: { username: counterpart?.username ?? counterpart?.display_name ?? "Player", displayName: counterpart?.display_name ?? "Player" }, sport: sport?.slug ?? "pickleball", challengeType: row.challenge_type, status: row.status, createdAt: row.created_at, scheduledAt: row.scheduled_at, locationName: row.location_name, stakeType: row.stake_type, stakeLabel: row.stake_label, stakeNote: row.stake_note };
    });
    return jsonResponse(200, { challenges });
  } catch (error) { console.error("[get-user-challenges] unexpected failure", { error }); return jsonResponse(500, { error: "Unable to load challenges" }); }
});
