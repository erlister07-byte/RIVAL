import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// All callers use the service-role client after deriving the actor from a
// verified JWT. Neither the block direction nor block rows reach the client.
export async function isPairBlocked(admin: SupabaseClient, callerId: string, targetId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("social_pair_is_blocked", {
    first_profile_id: callerId,
    second_profile_id: targetId
  });
  if (error) throw error;
  return data === true;
}
