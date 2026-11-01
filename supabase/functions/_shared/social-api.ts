import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getAuthenticatedUserId } from "./auth.ts";

export const socialCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SocialErrorCode =
  | "unauthenticated"
  | "invalid_request"
  | "not_found_or_unavailable"
  | "cooldown"
  | "unavailable"
  | "internal_error";

export class SocialApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: SocialErrorCode,
    message: string
  ) {
    super(message);
  }
}

export type SocialContext = {
  admin: SupabaseClient;
  authUserId: string;
  profileId: string;
};

export type PublicSocialProfile = {
  id: string;
  username: string;
  displayName: string;
};

export function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...socialCorsHeaders, "Content-Type": "application/json" }
  });
}

export function errorResponse(error: unknown, operation: string) {
  if (error instanceof SocialApiError) {
    return jsonResponse(error.status, {
      error: { code: error.code, message: error.message }
    });
  }

  if (error instanceof Error && /Supabase bearer token|Supabase session/.test(error.message)) {
    return jsonResponse(401, {
      error: { code: "unauthenticated", message: "Authentication required" }
    });
  }

  console.error(`[${operation}] internal failure`);
  return jsonResponse(500, {
    error: { code: "internal_error", message: "Social operation unavailable" }
  });
}

export async function readStrictBody(
  request: Request,
  allowedKeys: readonly string[]
): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SocialApiError(400, "invalid_request", "Invalid request");
  }

  const record = body as Record<string, unknown>;
  requireExactKeys(record, allowedKeys);
  return record;
}

export function requireExactKeys(
  body: Record<string, unknown>,
  allowedKeys: readonly string[]
) {
  const keys = Object.keys(body);
  if (keys.length !== allowedKeys.length || keys.some((key) => !allowedKeys.includes(key))) {
    throw new SocialApiError(400, "invalid_request", "Unsupported request fields");
  }
}

export function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new SocialApiError(400, "invalid_request", "Invalid target profile ID");
  }
  return value;
}

export async function getSocialContext(request: Request): Promise<SocialContext> {
  const authUserId = await getAuthenticatedUserId(request);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing social API configuration");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("onboarding_completed", true)
    .maybeSingle();

  if (error) throw new Error("Unable to resolve social profile");
  if (!profile) {
    throw new SocialApiError(404, "not_found_or_unavailable", "Profile unavailable");
  }

  return { admin, authUserId, profileId: profile.id };
}

export function publicProfile(row: {
  id: string;
  username: string;
  display_name: string;
}): PublicSocialProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name
  };
}

export function unavailableRelationship(): SocialApiError {
  return new SocialApiError(
    404,
    "not_found_or_unavailable",
    "Relationship unavailable"
  );
}
