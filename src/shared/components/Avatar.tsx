import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/application/theme";
import { getAvatarInitials, getAvatarPublicUrl } from "@/shared/lib/avatar";
import { debugLog } from "@/shared/lib/logger";

type Props = {
  profileId?: string;
  avatarUrl?: string;
  avatarVersion?: number | string;
  username?: string;
  displayName?: string;
  size?: number;
};

export function Avatar({
  profileId,
  avatarUrl,
  avatarVersion,
  username,
  displayName,
  size = 40
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);

  const resolvedUrl = useMemo(() => {
    if (avatarUrl) {
      return avatarUrl;
    }

    if (profileId) {
      return getAvatarPublicUrl(profileId, avatarVersion);
    }

    return undefined;
  }, [avatarUrl, avatarVersion, profileId]);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedUrl]);

  useEffect(() => {
    if (!resolvedUrl) {
      return;
    }

    console.log("[Avatar] resolved avatar URL", {
      profileId,
      avatarUrl,
      avatarVersion,
      resolvedUrl
    });
    debugLog("[Avatar] resolved avatar URL", {
      profileId,
      avatarUrl,
      avatarVersion,
      resolvedUrl
    });
  }, [avatarUrl, avatarVersion, profileId, resolvedUrl]);

  const initials = getAvatarInitials(username, displayName);

  if (resolvedUrl && !imageFailed) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2
          }
        ]}
        onError={() => {
          console.error("[Avatar] image render failed", {
            profileId,
            resolvedUrl
          });
          debugLog("[Avatar] image render failed", {
            profileId,
            resolvedUrl
          });
          setImageFailed(true);
        }}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2
        }
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.max(14, Math.round(size * 0.34)) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceMuted
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(91,33,182,0.12)",
    shadowColor: colors.primaryEnd,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4
    },
    elevation: 2
  },
  initials: {
    color: colors.primary,
    fontWeight: "800",
    letterSpacing: 0.4
  }
});
