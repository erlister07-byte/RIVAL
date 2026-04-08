import { supabase } from "./supabaseClient";

const DEFAULT_RATING = 1200;
const K_FACTOR = 32;
const MIN_RATING = 800;
const MAX_RATING = 2000;

export function clampRating(rating: number) {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, rating));
}

export function calculateExpectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
}

export function calculateUpdatedRatings(winnerRating: number, loserRating: number) {
  const winnerExpected = calculateExpectedScore(winnerRating, loserRating);
  const loserExpected = calculateExpectedScore(loserRating, winnerRating);

  return {
    winnerRating: clampRating(Math.round(winnerRating + K_FACTOR * (1 - winnerExpected))),
    loserRating: clampRating(Math.round(loserRating + K_FACTOR * (0 - loserExpected)))
  };
}

export function getRatingMatchReason(currentRating: number, opponentRating: number) {
  const ratingDelta = Math.abs(currentRating - opponentRating);

  if (ratingDelta <= 75) {
    return "Similar rating";
  }

  return "Good skill match";
}

export async function applyMatchRatingUpdate(matchId: string) {
  const { error } = await supabase.rpc("apply_match_rating", {
    match_id: matchId
  });

  if (error) {
    throw error;
  }
}

export { DEFAULT_RATING, K_FACTOR };
