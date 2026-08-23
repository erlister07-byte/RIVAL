import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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



Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authUserId = await getAuthenticatedUserId(request);
    const formData = await request.formData();
    const requestedProfileId = formData.get("profileId");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonResponse(400, { error: "Missing avatar file" });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profileError) {
      console.error("[upload-avatar] profile lookup failed", {
        authUserId,
        error: profileError
      });
      return jsonResponse(500, { error: profileError.message });
    }

    if (!profile) {
      return jsonResponse(404, { error: "Profile not found for authenticated user" });
    }

    if (typeof requestedProfileId === "string" && requestedProfileId !== profile.id) {
      return jsonResponse(403, { error: "Profile mismatch" });
    }

    const storagePath = `${profile.id}/avatar`;
    const contentType = file.type || "image/jpeg";
    const fileBuffer = await file.arrayBuffer();

    console.log("[upload-avatar] verified upload request", {
      authUserId,
      profileId: profile.id,
      storagePath,
      contentType,
      fileSize: file.size
    });

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(storagePath, fileBuffer, {
        upsert: true,
        contentType,
        cacheControl: "3600"
      });

    if (uploadError) {
      console.error("[upload-avatar] storage upload failed", {
        authUserId,
        profileId: profile.id,
        storagePath,
        error: uploadError
      });
      return jsonResponse(500, {
        error: uploadError.message,
        details: uploadError
      });
    }

    const version = Date.now().toString();
    const {
      data: { publicUrl }
    } = supabaseAdmin.storage.from("avatars").getPublicUrl(storagePath);

    console.log("[upload-avatar] avatar upload succeeded", {
      authUserId,
      profileId: profile.id,
      storagePath,
      uploadData,
      publicUrl
    });

    return jsonResponse(200, {
      success: true,
      profileId: profile.id,
      storagePath,
      version,
      avatarUrl: `${publicUrl}?v=${version}`
    });
  } catch (error) {
    console.error("[upload-avatar] unexpected failure", error);

    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Unknown upload error"
    });
  }
});
