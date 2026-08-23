import { createClient } from "npm:@supabase/supabase-js@2";

export async function getAuthenticatedUser(request: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase authentication configuration is missing");
  }

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing Supabase bearer token");
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await client.auth.getUser(authorization.slice("Bearer ".length).trim());

  if (error || !data.user) {
    throw new Error("Invalid or expired Supabase session");
  }

  return data.user;
}

export async function getAuthenticatedUserId(request: Request) {
  return (await getAuthenticatedUser(request)).id;
}
