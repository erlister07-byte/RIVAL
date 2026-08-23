import { supabase } from "@/services/supabaseClient";

export async function getAuthenticatedRequestHeaders() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session?.access_token) {
    throw new Error("You must be signed in to continue.");
  }

  return {
    Authorization: `Bearer ${data.session.access_token}`
  };
}
