import { firebaseAuth } from "@/services/firebase";
import { AVATAR_BUCKET, createAvatarVersion, getAvatarPublicUrl, getAvatarStoragePath } from "@/shared/lib/avatar";
import { debugError, debugLog, getSafeErrorPayload } from "@/shared/lib/logger";

type UploadProfilePhotoInput = {
  profileId: string;
  imageUri: string;
  mimeType?: string;
};

export async function uploadProfilePhoto({
  profileId,
  imageUri,
  mimeType
}: UploadProfilePhotoInput) {
  const storagePath = getAvatarStoragePath(profileId);
  const supabaseProjectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const currentFirebaseUser = firebaseAuth.currentUser;

  console.log("[profilePhotoService] upload start", {
    bucket: AVATAR_BUCKET,
    profileId,
    storagePath,
    mimeType: mimeType ?? "image/jpeg",
    hasFirebaseUser: Boolean(currentFirebaseUser?.uid),
    firebaseUid: currentFirebaseUser?.uid ?? null,
    imageUri,
    supabaseProjectUrl
  });

  try {
    if (!supabaseProjectUrl) {
      throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
    }

    if (!supabaseAnonKey) {
      throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY");
    }

    if (!currentFirebaseUser) {
      throw new Error("You need to be signed in to upload a photo.");
    }

    const firebaseIdToken = await currentFirebaseUser.getIdToken();
    const functionUrl = `${supabaseProjectUrl}/functions/v1/upload-avatar`;

    console.log("[profilePhotoService] file conversion start", {
      imageUri,
      profileId,
      storagePath
    });
    const response = await fetch(imageUri);

    if (!response.ok) {
      throw new Error(`Failed to read selected image. Response status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = mimeType ?? response.headers.get("content-type") ?? "image/jpeg";
    const avatarFile = new File([arrayBuffer], "avatar", { type: contentType });
    const formData = new FormData();

    formData.append("profileId", profileId);
    formData.append("file", avatarFile);

    console.log("[profilePhotoService] file conversion success", {
      bucket: AVATAR_BUCKET,
      profileId,
      storagePath,
      byteLength: arrayBuffer.byteLength,
      contentType
    });

    console.log("[profilePhotoService] upload request start", {
      functionUrl,
      profileId,
      storagePath,
      contentType,
      hasFirebaseIdToken: Boolean(firebaseIdToken)
    });

    const uploadResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseIdToken}`,
        apikey: supabaseAnonKey
      },
      body: formData
    });

    let uploadPayload: Record<string, unknown> | null = null;

    try {
      uploadPayload = (await uploadResponse.json()) as Record<string, unknown>;
    } catch {
      uploadPayload = null;
    }

    console.log("[profilePhotoService] upload response", {
      functionUrl,
      profileId,
      storagePath,
      status: uploadResponse.status,
      ok: uploadResponse.ok,
      uploadPayload
    });

    if (!uploadResponse.ok) {
      throw new Error(
        typeof uploadPayload?.error === "string"
          ? uploadPayload.error
          : `Avatar upload failed with status ${uploadResponse.status}`
      );
    }

    const version =
      typeof uploadPayload?.version === "string" || typeof uploadPayload?.version === "number"
        ? String(uploadPayload.version)
        : createAvatarVersion();
    const avatarUrl =
      typeof uploadPayload?.avatarUrl === "string" ? uploadPayload.avatarUrl : getAvatarPublicUrl(profileId, version);

    console.log("[profilePhotoService] public URL generated", {
      bucket: AVATAR_BUCKET,
      profileId,
      storagePath,
      version,
      avatarUrl
    });

    debugLog("[profilePhotoService] avatar upload succeeded", {
      bucket: AVATAR_BUCKET,
      profileId,
      storagePath,
      version,
      uploadPayload,
      avatarUrl
    });

    return {
      avatarUrl,
      version
    };
  } catch (error) {
    console.error("[profilePhotoService] upload failed", {
      bucket: AVATAR_BUCKET,
      profileId,
      storagePath,
      mimeType: mimeType ?? "image/jpeg",
      hasFirebaseUser: Boolean(currentFirebaseUser?.uid),
      firebaseUid: currentFirebaseUser?.uid ?? null,
      imageUri,
      supabaseProjectUrl,
      error
    });
    debugError("[profilePhotoService] avatar upload failed", error, {
      bucket: AVATAR_BUCKET,
      profileId,
      storagePath,
      mimeType: mimeType ?? "image/jpeg",
      hasFirebaseUser: Boolean(currentFirebaseUser?.uid),
      firebaseUid: currentFirebaseUser?.uid ?? null,
      imageUri,
      supabaseProjectUrl
    });
    throw error;
  }
}
