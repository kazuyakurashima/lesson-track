/**
 * JST date utilities — all date logic in this app must go through these helpers.
 * Server-side and client-side safe (no dependency on process.env.TZ).
 */

/** Today in JST as YYYY-MM-DD */
export function todayJST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

/** Current year/month in JST as { year, month } (month is 1-indexed) */
export function currentMonthJST(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  })
    .formatToParts(new Date())
    .reduce(
      (acc, p) => {
        if (p.type === "year") acc.year = Number(p.value);
        if (p.type === "month") acc.month = Number(p.value);
        return acc;
      },
      { year: 0, month: 0 }
    );
  return parts;
}

/** YYYY-MM-DD string N days ago from today in JST */
export function daysAgoJST(n: number): string {
  const now = new Date();
  // Shift to JST (+9h) then subtract days
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const target = new Date(jstMs - n * 24 * 60 * 60 * 1000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Check if a YYYY-MM-DD string is today in JST */
export function isTodayJST(dateStr: string): boolean {
  return dateStr === todayJST();
}

/** Format YYYY-MM to { year, month } */
export function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

/** Format { year, month } to YYYY-MM */
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
