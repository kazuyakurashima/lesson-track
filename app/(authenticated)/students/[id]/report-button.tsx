"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { todayJST, daysAgoJST } from "@/lib/date-utils";

interface Props {
  studentId: string;
}

type Preset = "this_month" | "last_month" | "last_30" | "all" | "custom";

export default function ReportButton({ studentId }: Props) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  function getDateRange(): { from: string; to: string } | null {
    const today = todayJST();
    const [y, m] = today.split("-").map(Number);

    switch (preset) {
      case "this_month":
        return {
          from: `${y}-${String(m).padStart(2, "0")}-01`,
          to: today,
        };
      case "last_month": {
        const lm = m === 1 ? 12 : m - 1;
        const ly = m === 1 ? y - 1 : y;
        const lastDay = new Date(ly, lm, 0).getDate();
        return {
          from: `${ly}-${String(lm).padStart(2, "0")}-01`,
          to: `${ly}-${String(lm).padStart(2, "0")}-${lastDay}`,
        };
      }
      case "last_30":
        return { from: daysAgoJST(30), to: today };
      case "all":
        return null;
      case "custom":
        if (customFrom && customTo) return { from: customFrom, to: customTo };
        if (customFrom) return { from: customFrom, to: today };
        return null;
    }
  }

  function handleGenerate() {
    const range = getDateRange();
    let url = `/api/students/${studentId}/report`;
    if (range) {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      url += `?${params.toString()}`;
    }
    window.open(url, "_blank");
    setOpen(false);
  }

  const presets: { value: Preset; label: string }[] = [
    { value: "this_month", label: "今月" },
    { value: "last_month", label: "先月" },
    { value: "last_30", label: "直近30日" },
    { value: "all", label: "全期間" },
    { value: "custom", label: "期間指定" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        title="保護者レポート"
      >
        <FileText className="h-5 w-5" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-card rounded-xl border border-border shadow-lg p-4 space-y-3">
            <p className="text-sm font-semibold">レポート出力</p>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1.5">
              {presets.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPreset(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    preset === value
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            {preset === "custom" && (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-white text-xs
                           focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-xs text-muted-foreground">〜</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-white text-xs
                           focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium
                       hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" />
              レポートを開く
            </button>
          </div>
        </>
      )}
    </div>
  );
}
