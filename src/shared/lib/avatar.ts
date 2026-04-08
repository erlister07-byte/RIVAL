export const AVATAR_BUCKET = "avatars";

export function getAvatarStoragePath(profileId: string) {
  return `${profileId}/avatar`;
}

export function createAvatarVersion() {
  return Date.now().toString();
}

export function getAvatarPublicUrl(profileId: string, version?: number | string) {
  const baseUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${getAvatarStoragePath(profileId)}`;
  return version ? `${baseUrl}?v=${version}` : baseUrl;
}

export function getAvatarInitials(username?: string, displayName?: string) {
  const source = (displayName?.trim() || username?.trim() || "?").replace(/^@/, "");
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}
