import { Alert, Linking } from "react-native";

import { debugError, debugLog } from "./logger";

type BetaFeedbackInput = {
  screen: string;
  profileId?: string | null;
  challengeId?: string | null;
  matchId?: string | null;
  status?: string | null;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

function buildMailtoBody(input: BetaFeedbackInput) {
  const lines = [
    "Closed beta issue report",
    "",
    `Screen: ${input.screen}`,
    `Profile ID: ${input.profileId ?? "unknown"}`,
    `Challenge ID: ${input.challengeId ?? "n/a"}`,
    `Match ID: ${input.matchId ?? "n/a"}`,
    `Status: ${input.status ?? "n/a"}`,
    `Timestamp: ${new Date().toISOString()}`
  ];

  if (input.extra) {
    lines.push("", "Extra context:");
    Object.entries(input.extra).forEach(([key, value]) => {
      lines.push(`- ${key}: ${value ?? "n/a"}`);
    });
  }

  lines.push("", "What happened?", "", "What did you expect?", "", "Can you reproduce it?");

  return lines.join("\n");
}

export async function openBetaFeedbackEmail(input: BetaFeedbackInput) {
  const subject = encodeURIComponent(`RIVAL beta issue: ${input.screen}`);
  const body = encodeURIComponent(buildMailtoBody(input));
  const url = `mailto:?subject=${subject}&body=${body}`;

  debugLog("[betaFeedback] opening beta issue email", input);

  try {
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert(
        "Report Beta Issue",
        "Mail is not available on this device. Please copy the details from this screen and send them to the beta team."
      );
      return;
    }

    await Linking.openURL(url);
  } catch (error) {
    debugError("[betaFeedback] failed to open beta issue email", error, input);
    Alert.alert("Report Beta Issue", "Unable to open your mail app right now.");
  }
}
