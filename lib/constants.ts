/**
 * Shared constants for Lesson Track.
 * Single source of truth for thresholds, options, and labels.
 */

// ── Scoring thresholds ──────────────────────────────────────────────
export const SCORE_PASS_THRESHOLD = 0.8; // 80% → passed
export const SCORE_WARNING_THRESHOLD = 0.6; // below 60% → warning color

// ── AI confidence thresholds ────────────────────────────────────────
export const AI_CONFIDENCE_HIGH = 0.7; // green
export const AI_CONFIDENCE_MINIMUM = 0.5; // below → red, expand manual

// ── Image upload ────────────────────────────────────────────────────
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

// ── Student options ─────────────────────────────────────────────────
export const GRADE_OPTIONS = [
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
] as const;

export type Grade = (typeof GRADE_OPTIONS)[number];

// ── Labels ──────────────────────────────────────────────────────────
const ENROLLMENT_LABELS: Record<string, string> = {
  ongoing: "継続受講",
  spring_course: "春期講習",
  trial: "体験",
};

const STEP_LABELS: Record<string, string> = {
  learning: "ラーニング",
  step1: "ステップ1",
  step2: "ステップ2",
};

export function enrollmentLabel(type: string): string {
  return ENROLLMENT_LABELS[type] ?? type;
}

export function stepLabel(type: string): string {
  return STEP_LABELS[type] ?? type;
}

// ── Circled numbers ─────────────────────────────────────────────────
export const CIRCLED_TO_NUM: Record<string, string> = {
  "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5",
  "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10",
  "⑪": "11", "⑫": "12", "⑬": "13", "⑭": "14", "⑮": "15",
  "⑯": "16", "⑰": "17", "⑱": "18", "⑲": "19", "⑳": "20",
};
