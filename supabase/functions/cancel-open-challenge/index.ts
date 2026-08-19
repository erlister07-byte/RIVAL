import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose@5";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const firebaseJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
function jsonResponse(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function admin() { if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Missing Supabase function configuration"); return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); }
function getFirebaseUid(payload: JWTPayload) { return typeof payload.user_id === "string" ? payload.user_id : typeof payload.sub === "string" ? payload.sub : null; }
async function verifyFirebaseToken(header: string | null) { if (!firebaseProjectId || !header?.startsWith("Bearer ")) return null; try { return (await jwtVerify(header.slice(7).trim(), firebaseJwks, { issuer: `https://securetoken.google.com/${firebaseProjectId}`, audience: firebaseProjectId })).payload; } catch { return null; } }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  try {
    const claims = await verifyFirebaseToken(request.headers.get("Authorization"));
    const firebaseUid = claims ? getFirebaseUid(claims) : null;
    if (!firebaseUid) return jsonResponse(401, { error: "Unauthorized" });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).length !== 1 || typeof body.challengeId !== "string" || !body.challengeId) return jsonResponse(400, { error: "Invalid open challenge request" });
    const supabaseAdmin = admin();
    const { data: caller, error: callerError } = await supabaseAdmin.from("profiles").select("id").eq("firebase_uid", firebaseUid).maybeSingle();
    if (callerError) return jsonResponse(500, { error: "Unable to resolve current profile" });
    if (!caller) return jsonResponse(404, { error: "Profile not found for Firebase user" });
    const { data: rows, error: cancelError } = await supabaseAdmin.from("challenges").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", body.challengeId).eq("challenger_profile_id", caller.id).eq("is_open", true).eq("status", "pending").is("opponent_profile_id", null).select("id");
    if (cancelError) return jsonResponse(500, { error: "Unable to cancel open challenge" });
    if (!rows?.length) return jsonResponse(409, { error: "This open challenge is no longer pending" });
    return jsonResponse(200, { success: true });
  } catch (error) { console.error("[cancel-open-challenge] unexpected failure", { error }); return jsonResponse(500, { error: "Unable to cancel open challenge" }); }
});
