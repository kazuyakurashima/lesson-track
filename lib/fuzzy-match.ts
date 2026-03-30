/**
 * Fuzzy matching utilities for AI result → DB record matching.
 * Used by lesson record page to match AI-extracted names against DB entries.
 */

import { CIRCLED_TO_NUM } from "./constants";

/** Normalize a string for fuzzy matching (fullwidth→halfwidth, circled→digit, symbols, trim, lowercase). */
export function normalize(s: string): string {
  let result = s
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // Convert circled numbers to regular digits
  for (const [circled, num] of Object.entries(CIRCLED_TO_NUM)) {
    result = result.replaceAll(circled, num);
  }
  // Normalize common punctuation variants (・↔,↔、↔/)
  result = result.replace(/[・、，,/／]/g, ",");
  return result;
}

/**
 * Alias map: AI-returned names → DB content_group names.
 * Handles common print header patterns that don't exactly match DB names.
 */
export const CONTENT_GROUP_ALIASES: Record<string, string> = {
  // English
  "英文法1": "英文法",
  "英文法１": "英文法",
  "英文法 1": "英文法",
  "英文法 １": "英文法",
  "英文法入門": "英文法 入門",
  // Math
  "数学1年": "1年[共通版]",
  "数学１年": "1年[共通版]",
  "数学 1年": "1年[共通版]",
  "数学 １年": "1年[共通版]",
  "中1": "1年[共通版]",
  "中学1年": "1年[共通版]",
  "数学2年": "2年[共通版]",
  "数学２年": "2年[共通版]",
  "数学 2年": "2年[共通版]",
  "数学 ２年": "2年[共通版]",
  "中2": "2年[共通版]",
  "中学2年": "2年[共通版]",
  "1年まとめ": "1年のまとめ",
  "1年の纏め": "1年のまとめ",
  "2年まとめ": "2年のまとめ",
  "2年の纏め": "2年のまとめ",
  // Japanese
  "東1年": "東京書籍1年 漢字",
  "東１年": "東京書籍1年 漢字",
  "東京書籍1年": "東京書籍1年 漢字",
  "東京書籍１年": "東京書籍1年 漢字",
  "東2年": "東京書籍2年 漢字",
  "東２年": "東京書籍2年 漢字",
  "東京書籍2年": "東京書籍2年 漢字",
  "東京書籍２年": "東京書籍2年 漢字",
  // Science
  "入門1年": "入門 1年",
  "入門 １年": "入門 1年",
  "入門１年": "入門 1年",
  "理科 1年": "理科1年",
  "理科 １年": "理科1年",
};

/** Apply alias mapping, then normalize */
export function resolveAlias(aiName: string): string {
  const norm = normalize(aiName);
  for (const [alias, target] of Object.entries(CONTENT_GROUP_ALIASES)) {
    if (norm === normalize(alias)) return normalize(target);
  }
  return norm;
}

/**
 * Fuzzy-match an AI-returned name against a list of DB records.
 * Returns the best match or null.
 */
export function fuzzyMatch<T extends { name: string }>(
  aiName: string | null,
  candidates: T[],
  tiebreaker: (a: T, b: T) => number,
  useAlias = false
): T | null {
  if (!aiName || candidates.length === 0) return null;

  const norm = useAlias ? resolveAlias(aiName) : normalize(aiName);

  // 1. Exact match
  const exact = candidates.find((c) => normalize(c.name) === norm);
  if (exact) return exact;

  // 2. Partial match
  const partials: { item: T; overlap: number; lenDiff: number }[] = [];
  for (const c of candidates) {
    const cn = normalize(c.name);
    if (cn.includes(norm) || norm.includes(cn)) {
      const overlap = Math.min(cn.length, norm.length);
      const lenDiff = Math.abs(cn.length - norm.length);
      partials.push({ item: c, overlap, lenDiff });
    }
  }

  if (partials.length === 0) return null;

  // 3. Prefer closest in length, then longest overlap, then tiebreaker
  partials.sort((a, b) => {
    if (a.lenDiff !== b.lenDiff) return a.lenDiff - b.lenDiff;
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    return tiebreaker(a.item, b.item);
  });

  return partials[0].item;
}
