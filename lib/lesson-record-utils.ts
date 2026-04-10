import { SCORE_PASS_THRESHOLD } from "@/lib/constants";
import type { CompletionType, ScoreSource, StepType } from "@/lib/types/supabase";

export function calcCompletionType(
  stepType: StepType,
  score: number | null,
  maxScore: number | null
): CompletionType | null {
  if (stepType === "step2" && score !== null && maxScore !== null && maxScore > 0) {
    return score / maxScore >= SCORE_PASS_THRESHOLD ? "passed" : null;
  }

  if (stepType === "step1" && score !== null && maxScore !== null) {
    return score === maxScore ? "step1_perfect" : null;
  }

  return null;
}

export function calcScoreSource(
  score: number | null,
  aiExtractedScore: number | null | undefined
): ScoreSource | null {
  if (score === null) return null;
  if (aiExtractedScore == null) return "manual";
  return score === aiExtractedScore ? "ai_extracted" : "ai_corrected";
}
