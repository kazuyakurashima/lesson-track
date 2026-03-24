"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { StepType, ContentCategory } from "@/lib/types/supabase";
import { todayJST } from "@/lib/date-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Student {
  id: string;
  name: string;
  grade: string;
}

interface Subject {
  id: string;
  name: string;
  display_order: number;
}

interface ContentGroup {
  id: string;
  subject_id: string;
  name: string;
  category: ContentCategory;
  display_order: number;
}

interface Unit {
  id: string;
  name: string;
  unit_number: number;
  content_group_id: string;
}

interface Recommendation {
  unit: Unit;
  stepType: StepType;
  reason: string;
  contentGroupName: string;
  contentGroupId: string;
  subjectId: string;
}

interface AiAnalyzeResult {
  subject_name: string | null;
  content_group_name: string | null;
  unit_name: string | null;
  step_type: StepType | null;
  score: number | null;
  max_score: number | null;
  confidence: number;
  raw_response?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PHOTO_STEPS = ["生徒", "撮影", "確認"] as const;

const STEP_TYPE_OPTIONS: { value: StepType; label: string }[] = [
  { value: "learning", label: "ラーニング" },
  { value: "step1", label: "ステップ1" },
  { value: "step2", label: "ステップ2" },
];

/** Circled number mappings for normalization */
const CIRCLED_TO_NUM: Record<string, string> = {
  "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5",
  "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9", "⑩": "10",
  "⑪": "11", "⑫": "12", "⑬": "13", "⑭": "14", "⑮": "15",
  "⑯": "16", "⑰": "17", "⑱": "18", "⑲": "19", "⑳": "20",
};

/** Normalize a string for fuzzy matching (fullwidth→halfwidth, circled→digit, trim, lowercase). */
function normalize(s: string): string {
  let result = s
    .normalize("NFKC") // fullwidth → halfwidth, etc.
    .replace(/\u3000/g, " ") // fullwidth space
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // Convert circled numbers to regular digits for matching
  for (const [circled, num] of Object.entries(CIRCLED_TO_NUM)) {
    result = result.replaceAll(circled, num);
  }
  return result;
}

/**
 * Alias map: AI-returned names → DB content_group names.
 * Handles common print header patterns that don't exactly match DB names.
 */
const CONTENT_GROUP_ALIASES: Record<string, string> = {
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
};

/** Apply alias mapping, then normalize */
function resolveAlias(aiName: string): string {
  const norm = normalize(aiName);
  for (const [alias, target] of Object.entries(CONTENT_GROUP_ALIASES)) {
    if (norm === normalize(alias)) return normalize(target);
  }
  return norm;
}

/** Fuzzy-match an AI-returned name against a list of DB records.
 *  Returns the best match or null. */
function fuzzyMatch<T extends { name: string }>(
  aiName: string | null,
  candidates: T[],
  tiebreaker: (a: T, b: T) => number,
  useAlias = false
): T | null {
  if (!aiName || candidates.length === 0) return null;

  const norm = useAlias ? resolveAlias(aiName) : normalize(aiName);

  // 1. Exact match (after alias resolution)
  const exact = candidates.find((c) => normalize(c.name) === norm);
  if (exact) return exact;

  // 2. Partial match — collect all candidates where one contains the other
  const partials: { item: T; overlap: number; lenDiff: number }[] = [];
  for (const c of candidates) {
    const cn = normalize(c.name);
    if (cn.includes(norm) || norm.includes(cn)) {
      // overlap = how many chars of the longer string are covered
      const overlap = Math.min(cn.length, norm.length);
      // lenDiff = how close the candidate is to the AI string (lower = better)
      const lenDiff = Math.abs(cn.length - norm.length);
      partials.push({ item: c, overlap, lenDiff });
    }
  }

  if (partials.length === 0) return null;

  // 3. Prefer candidate closest in length to AI string (smallest lenDiff),
  //    then longest overlap, then tiebreaker
  partials.sort((a, b) => {
    if (a.lenDiff !== b.lenDiff) return a.lenDiff - b.lenDiff;
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    return tiebreaker(a.item, b.item);
  });

  return partials[0].item;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ---- Mode ---------------------------------------------------------------
  type Mode = "photo" | "manual";
  const [mode, setMode] = useState<Mode>("photo");

  // ---- Wizard step (photo mode) ------------------------------------------
  const [currentStep, setCurrentStep] = useState(0);

  // ---- Student (shared) ---------------------------------------------------
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // ---- Master data --------------------------------------------------------
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allContentGroups, setAllContentGroups] = useState<ContentGroup[]>([]);
  const [contentGroups, setContentGroups] = useState<ContentGroup[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // ---- Selections ---------------------------------------------------------
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedContentGroupId, setSelectedContentGroupId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedStepType, setSelectedStepType] = useState<StepType>("step1");
  const [lessonDate, setLessonDate] = useState(todayJST);

  // ---- Recommendations ----------------------------------------------------
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // ---- Photo / AI ---------------------------------------------------------
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiAnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState("");

  // ---- Confirm / Save -----------------------------------------------------
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // =========================================================================
  // Data loading
  // =========================================================================

  // Load students
  useEffect(() => {
    supabase
      .from("students")
      .select("id, name, grade")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setStudents(data as Student[]);
      });
  }, [supabase]);

  // Load subjects when student selected
  useEffect(() => {
    if (!selectedStudent) return;

    supabase
      .from("student_subjects")
      .select("subject_id, subjects(id, name, display_order)")
      .eq("student_id", selectedStudent.id)
      .then(({ data }) => {
        if (data) {
          const rows = data as unknown as Array<{ subjects: Subject }>;
          const subs = rows
            .map((d) => d.subjects)
            .sort((a, b) => a.display_order - b.display_order);
          setSubjects(subs);
        }
      });
  }, [selectedStudent, supabase]);

  // Load ALL content groups for the student's subjects (for AI matching + recs)
  useEffect(() => {
    if (subjects.length === 0) {
      setAllContentGroups([]);
      return;
    }
    const subjectIds = subjects.map((s) => s.id);
    supabase
      .from("content_groups")
      .select("id, subject_id, name, category, display_order")
      .in("subject_id", subjectIds)
      .order("display_order")
      .then(({ data }) => {
        if (data) setAllContentGroups(data as ContentGroup[]);
      });
  }, [subjects, supabase]);

  // Filter content groups when subject changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setContentGroups([]);
      return;
    }
    const filtered = allContentGroups.filter(
      (cg) => cg.subject_id === selectedSubjectId
    );
    setContentGroups(filtered);
    if (filtered.length > 0 && !filtered.some((cg) => cg.id === selectedContentGroupId)) {
      setSelectedContentGroupId(filtered[0].id);
    } else if (filtered.length === 0) {
      setSelectedContentGroupId("");
    }
  }, [selectedSubjectId, allContentGroups, selectedContentGroupId]);

  // Load units when content group changes
  useEffect(() => {
    if (!selectedContentGroupId) {
      setUnits([]);
      return;
    }
    supabase
      .from("units")
      .select("id, name, unit_number, content_group_id")
      .eq("content_group_id", selectedContentGroupId)
      .order("unit_number")
      .then(({ data }) => {
        if (data) setUnits(data as Unit[]);
      });
  }, [selectedContentGroupId, supabase]);

  // =========================================================================
  // Recommendations
  // =========================================================================

  const loadRecommendations = useCallback(async () => {
    if (!selectedStudent || subjects.length === 0) return;

    const subjectIds = subjects.map((s) => s.id);
    const { data: cgs } = await supabase
      .from("content_groups")
      .select("id, subject_id, name, category, display_order")
      .in("subject_id", subjectIds)
      .order("display_order");

    if (!cgs) return;

    const { data: records } = (await supabase
      .from("lesson_records")
      .select("unit_id, step_type, score, max_score, completion_type")
      .eq("student_id", selectedStudent.id)) as {
      data: Array<{
        unit_id: string;
        step_type: string;
        score: number | null;
        max_score: number | null;
        completion_type: string | null;
      }> | null;
    };

    if (!records) return;

    // Batch-load ALL units for the student's content groups (avoids N+1)
    const cgIds = (cgs as ContentGroup[]).map((cg) => cg.id);
    const { data: allCgUnits } = (await supabase
      .from("units")
      .select("id, name, unit_number, content_group_id")
      .in("content_group_id", cgIds)
      .order("unit_number")) as { data: Unit[] | null };

    if (!allCgUnits) return;

    const recs: Recommendation[] = [];

    for (const cg of cgs as ContentGroup[]) {
      const cgUnits = allCgUnits.filter((u) => u.content_group_id === cg.id);

      for (const unit of cgUnits) {
        const unitRecords = records.filter((r) => r.unit_id === unit.id);
        const hasLearning = unitRecords.some(
          (r) => r.step_type === "learning"
        );
        const hasStep1 = unitRecords.some((r) => r.step_type === "step1");
        const step2Records = unitRecords.filter(
          (r) => r.step_type === "step2"
        );
        const hasPassedStep2 = unitRecords.some(
          (r) =>
            r.completion_type === "passed" ||
            r.completion_type === "step1_perfect"
        );

        if (hasPassedStep2) continue;

        // Retest needed
        if (step2Records.length > 0) {
          const latest = step2Records[step2Records.length - 1];
          if (!latest.completion_type) {
            recs.push({
              unit,
              stepType: "step2",
              reason: `前回 ${latest.score}/${latest.max_score} → 再テスト`,
              contentGroupName: cg.name,
              contentGroupId: cg.id,
              subjectId: cg.subject_id,
            });
            break;
          }
        }

        // Vocabulary: learning done, step2 not done
        if (
          cg.category === "vocabulary" &&
          hasLearning &&
          step2Records.length === 0
        ) {
          recs.push({
            unit,
            stepType: "step2",
            reason: "ラーニング済み → ステップ2テスト",
            contentGroupName: cg.name,
            contentGroupId: cg.id,
            subjectId: cg.subject_id,
          });
          break;
        }

        // Academic: step1 done, step2 not done
        if (
          cg.category === "academic" &&
          hasStep1 &&
          step2Records.length === 0
        ) {
          recs.push({
            unit,
            stepType: "step2",
            reason: "ステップ1済み → ステップ2",
            contentGroupName: cg.name,
            contentGroupId: cg.id,
            subjectId: cg.subject_id,
          });
          break;
        }

        // Not started yet
        if (unitRecords.length === 0) {
          recs.push({
            unit,
            stepType: "learning",
            reason: "次の単元",
            contentGroupName: cg.name,
            contentGroupId: cg.id,
            subjectId: cg.subject_id,
          });
          break;
        }
      }
    }

    setRecommendations(recs);
  }, [selectedStudent, subjects, supabase]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // =========================================================================
  // AI Analysis & Matching
  // =========================================================================

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  }

  /** Match AI result against DB records and populate selections. */
  const applyAiResult = useCallback(
    async (result: AiAnalyzeResult) => {
      // --- Match subject ---
      const matchedSubject = fuzzyMatch(
        result.subject_name,
        subjects,
        (a, b) => a.display_order - b.display_order
      );
      if (matchedSubject) {
        setSelectedSubjectId(matchedSubject.id);
      }

      // We need content groups for the matched subject
      const targetSubjectId = matchedSubject?.id ?? "";
      const cgsForSubject = allContentGroups.filter(
        (cg) => cg.subject_id === targetSubjectId
      );

      // --- Match content group (with unit-based disambiguation) ---
      let matchedCG = fuzzyMatch(
        result.content_group_name,
        cgsForSubject,
        (a, b) => a.display_order - b.display_order,
        true // use alias mapping for content group names
      );

      // If we have a unit name, try to find which CG actually contains it.
      // This handles cases like AI returning "英文法" when the unit belongs to "英文法 入門".
      if (result.unit_name && cgsForSubject.length > 0) {
        const cgIds = cgsForSubject.map((cg) => cg.id);
        const { data: allCgUnits } = await supabase
          .from("units")
          .select("id, name, unit_number, content_group_id")
          .in("content_group_id", cgIds)
          .order("unit_number");

        if (allCgUnits && allCgUnits.length > 0) {
          // Try to find the unit across all CGs for this subject
          const unitMatch = fuzzyMatch(
            result.unit_name,
            allCgUnits as Unit[],
            (a, b) => a.unit_number - b.unit_number
          );
          if (unitMatch) {
            // Use the CG that actually contains this unit
            const correctCG = cgsForSubject.find(
              (cg) => cg.id === unitMatch.content_group_id
            );
            if (correctCG) {
              matchedCG = correctCG;
            }
          }
        }
      }

      if (matchedCG) {
        setSelectedContentGroupId(matchedCG.id);

        // Load units for matched CG
        const { data: cgUnits } = await supabase
          .from("units")
          .select("id, name, unit_number, content_group_id")
          .eq("content_group_id", matchedCG.id)
          .order("unit_number");

        if (cgUnits) {
          const matchedUnit = fuzzyMatch(
            result.unit_name,
            cgUnits as Unit[],
            (a, b) => a.unit_number - b.unit_number
          );
          if (matchedUnit) {
            setSelectedUnit(matchedUnit);
          }
        }
      }

      // --- Step type ---
      if (result.step_type) {
        setSelectedStepType(result.step_type);
      }

      // --- Score ---
      if (result.score !== null) {
        setScore(String(result.score));
      }
      if (result.max_score !== null) {
        setMaxScore(String(result.max_score));
      }
    },
    [subjects, allContentGroups, supabase]
  );

  /** Apply recommendation values as fallback when AI returns null for all fields. */
  const applyRecommendationFallback = useCallback(() => {
    if (recommendations.length === 0) return;
    const rec = recommendations[0];
    setSelectedSubjectId(rec.subjectId);
    setSelectedContentGroupId(rec.contentGroupId);
    setSelectedUnit(rec.unit);
    setSelectedStepType(rec.stepType);
  }, [recommendations]);

  async function analyzeImage() {
    if (!imageFile) return;
    setAnalyzing(true);
    setAiError(false);
    setAiErrorMsg("");
    setAiResult(null);

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("Analyze API error:", res.status, errBody);
        throw new Error(errBody.debug || errBody.error || "API error");
      }

      const data: AiAnalyzeResult = await res.json();
      setAiResult(data);

      // Check if AI returned anything useful
      const hasAnyField =
        data.subject_name ||
        data.content_group_name ||
        data.unit_name ||
        data.step_type ||
        data.score !== null;

      if (hasAnyField) {
        await applyAiResult(data);
      } else {
        // All null — use recommendations as fallback
        applyRecommendationFallback();
      }

      // Move to confirmation step
      setCurrentStep(2);
    } catch (err) {
      setAiError(true);
      setAiErrorMsg(err instanceof Error ? err.message : "Unknown error");
      applyRecommendationFallback();
      setCurrentStep(2);
    } finally {
      setAnalyzing(false);
    }
  }

  // =========================================================================
  // Save
  // =========================================================================

  const canSave: boolean =
    Boolean(selectedSubjectId) &&
    Boolean(selectedContentGroupId) &&
    Boolean(selectedUnit) &&
    Boolean(selectedStepType) &&
    Boolean(lessonDate) &&
    !(score !== "" && maxScore === "");

  async function handleSave() {
    if (!selectedStudent || !selectedUnit || !canSave) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const scoreNum = score ? parseInt(score) : null;
    const maxScoreNum = maxScore ? parseInt(maxScore) : null;

    // Determine completion_type
    let completionType: string | null = null;
    if (
      selectedStepType === "step2" &&
      scoreNum !== null &&
      maxScoreNum !== null &&
      maxScoreNum > 0 &&
      scoreNum / maxScoreNum >= 0.8
    ) {
      completionType = "passed";
    }
    if (
      selectedStepType === "step1" &&
      scoreNum !== null &&
      maxScoreNum !== null &&
      scoreNum === maxScoreNum
    ) {
      completionType = "step1_perfect";
    }

    // Determine score_source
    let scoreSource: string | null = null;
    if (scoreNum !== null) {
      if (aiResult) {
        scoreSource =
          scoreNum === aiResult.score ? "ai_extracted" : "ai_corrected";
      } else {
        scoreSource = "manual";
      }
    }

    const { data: record, error } = await supabase
      .from("lesson_records")
      .insert({
        student_id: selectedStudent.id,
        unit_id: selectedUnit.id,
        instructor_id: user.id,
        lesson_date: lessonDate,
        step_type: selectedStepType,
        score: scoreNum,
        max_score: maxScoreNum,
        score_source: scoreSource,
        completion_type: completionType,
        comment: comment.trim() || null,
      })
      .select("id")
      .single();

    if (error || !record) {
      setSaving(false);
      setSaveError("記録の保存に失敗しました");
      return;
    }

    // Upload image if exists
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() ?? "jpg";
      const path = `${selectedStudent.id}/${record.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("answer-sheets")
        .upload(path, imageFile);

      if (uploadError) {
        console.error("Image upload failed:", uploadError);
        setSaving(false);
        setSaveError("記録は保存されましたが、画像のアップロードに失敗しました。生徒詳細ページから再アップロードできます。");
        setSaveSuccess(true);
        return;
      }

      const { error: imageRecordError } = await supabase
        .from("record_images")
        .insert({
          record_id: record.id,
          storage_path: path,
          ai_extracted_score: aiResult?.score ?? null,
          ai_confidence: aiResult?.confidence ?? null,
        });

      if (imageRecordError) {
        console.error("Image record insert failed:", imageRecordError);
        setSaving(false);
        setSaveError("記録と画像は保存されましたが、画像メタデータの登録に失敗しました。");
        setSaveSuccess(true);
        return;
      }
    }

    setSaving(false);
    setSaveError(null);
    setSaveSuccess(true);
  }

  /** Reset form for "続けて記録する" */
  function handleContinue() {
    // Keep the same student, reset everything else
    setCurrentStep(mode === "photo" ? 1 : 0);
    setMode("photo");
    setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : "");
    setSelectedContentGroupId("");
    setSelectedUnit(null);
    setSelectedStepType("step1");
    setLessonDate(todayJST());
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setAiResult(null);
    setAiError(false);
    setScore("");
    setMaxScore("100");
    setComment("");
    setSaveSuccess(false);
    setSaveError(null);
    // Reload recommendations
    loadRecommendations();
  }

  function handleRecommendationSelect(rec: Recommendation) {
    setSelectedSubjectId(rec.subjectId);
    setSelectedContentGroupId(rec.contentGroupId);
    setSelectedUnit(rec.unit);
    setSelectedStepType(rec.stepType);
  }

  // =========================================================================
  // Derived state
  // =========================================================================

  /** Whether the confirmation screen should show expanded manual selection UI */
  const shouldExpandManual =
    aiError ||
    (aiResult !== null &&
      (aiResult.confidence < 0.5 ||
        !aiResult.subject_name ||
        !aiResult.content_group_name ||
        !aiResult.unit_name));

  const showYellowWarning =
    aiResult !== null &&
    aiResult.confidence >= 0.5 &&
    aiResult.confidence < 0.7 &&
    !shouldExpandManual;

  const currentContentGroupName = contentGroups.find(
    (c) => c.id === selectedContentGroupId
  )?.name;

  // =========================================================================
  // Render helpers
  // =========================================================================

  /** Stepper bar for 3-step photo flow */
  function renderStepper() {
    return (
      <div className="flex items-center gap-1">
        {PHOTO_STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex items-center gap-1">
            <div className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= currentStep ? "bg-primary" : "bg-border"
                }`}
              />
              <p
                className={`text-[10px] mt-1 text-center ${
                  i <= currentStep
                    ? "text-primary font-medium"
                    : "text-text-muted"
                }`}
              >
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /** Subject / ContentGroup / Unit / StepType selectors */
  function renderManualSelectors() {
    return (
      <div className="space-y-4">
        {/* Subject tabs */}
        {subjects.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              科目
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {subjects.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(sub.id);
                    setSelectedUnit(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedSubjectId === sub.id
                      ? "bg-primary text-white"
                      : "bg-surface text-text-muted"
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content group select */}
        {contentGroups.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              教材
            </label>
            <select
              value={selectedContentGroupId}
              onChange={(e) => {
                setSelectedContentGroupId(e.target.value);
                setSelectedUnit(null);
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                       focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {contentGroups.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Unit select */}
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">
            単元
          </label>
          <select
            value={selectedUnit?.id ?? ""}
            onChange={(e) => {
              const unit = units.find((u) => u.id === e.target.value);
              setSelectedUnit(unit ?? null);
            }}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                     focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">選択してください</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>

        {/* Step type */}
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">
            ステップ
          </label>
          <div className="flex gap-2">
            {STEP_TYPE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedStepType(value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStepType === value
                    ? "bg-primary text-white"
                    : "bg-surface text-text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /** Recommendations section */
  function renderRecommendations() {
    if (recommendations.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary">
          <Zap size={16} />
          おすすめ
        </div>
        {recommendations.map((rec, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleRecommendationSelect(rec)}
            className="w-full text-left bg-secondary/5 border border-secondary/20
                     rounded-xl p-3 hover:bg-secondary/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                {rec.contentGroupName}
              </span>
              <span className="text-sm font-medium">{rec.unit.name}</span>
            </div>
            <p className="text-xs text-text-muted mt-1">{rec.reason}</p>
          </button>
        ))}
      </div>
    );
  }

  /** Score + MaxScore + Comment inputs */
  function renderScoreInputs() {
    return (
      <div className="bg-card rounded-xl border border-border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text mb-1.5">
              点数
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white
                       text-center text-xl font-bold tabular-nums
                       focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="—"
            />
          </div>
          <span className="text-xl text-text-muted mt-6">/</span>
          <div className="flex-1">
            <label className="block text-sm font-medium text-text mb-1.5">
              満点
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white
                       text-center text-xl font-bold tabular-nums
                       focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="100"
            />
          </div>
        </div>

        {/* Validation: score provided but maxScore missing */}
        {score && !maxScore && (
          <p className="text-xs text-danger">満点を入力してください</p>
        )}

        <div>
          <label className="block text-sm font-medium text-text mb-1.5">
            コメント（任意）
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                     placeholder:text-text-muted/50 focus:outline-none focus:ring-2
                     focus:ring-primary/20 focus:border-primary resize-none"
            placeholder="気になった点などをメモ"
          />
        </div>
      </div>
    );
  }

  /** Date picker */
  function renderDatePicker() {
    return (
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          授業日
        </label>
        <input
          type="date"
          value={lessonDate}
          onChange={(e) => setLessonDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                   focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    );
  }

  // =========================================================================
  // Render
  // =========================================================================

  // ---------- Save success screen ------------------------------------------
  if (saveSuccess) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">授業記録</h1>
        </div>

        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10">
            <Check size={32} className="text-success" />
          </div>
          <p className="text-lg font-semibold">保存しました</p>
          <p className="text-sm text-text-muted">
            {selectedStudent?.name} ・ {currentContentGroupName} ・{" "}
            {selectedUnit?.name}
          </p>
          {saveError && (
            <div className="mt-2 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
              {saveError}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className="w-full py-3 rounded-lg bg-primary text-white font-medium
                     hover:bg-primary-dark transition-all"
          >
            続けて記録する
          </button>
          <button
            onClick={() => {
              if (selectedStudent) {
                router.push(`/students/${selectedStudent.id}`);
              } else {
                router.push("/");
              }
              router.refresh();
            }}
            className="w-full py-3 rounded-lg border border-border text-text font-medium
                     hover:bg-surface transition-all"
          >
            生徒ページへ
          </button>
        </div>
      </div>
    );
  }

  // ---------- Manual mode --------------------------------------------------
  if (mode === "manual" && selectedStudent) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setMode("photo");
              setCurrentStep(0);
            }}
            className="p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">授業記録（手動入力）</h1>
        </div>

        <p className="text-sm text-text-muted">
          <span className="font-medium text-text">{selectedStudent.name}</span>{" "}
          の記録
        </p>

        {/* Date picker */}
        {renderDatePicker()}

        {/* Manual selectors */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          {renderManualSelectors()}
        </div>

        {/* Recommendations */}
        {renderRecommendations()}

        {/* Score inputs */}
        {renderScoreInputs()}

        {/* Validation messages */}
        {!selectedSubjectId && (
          <p className="text-xs text-danger">科目を選択してください</p>
        )}
        {selectedSubjectId && !selectedContentGroupId && (
          <p className="text-xs text-danger">教材を選択してください</p>
        )}
        {selectedContentGroupId && !selectedUnit && (
          <p className="text-xs text-danger">単元を選択してください</p>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="w-full py-3 rounded-lg bg-primary text-white font-semibold
                   hover:bg-primary-dark active:scale-[0.98] transition-all
                   disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Check size={18} />
          )}
          保存する
        </button>
      </div>
    );
  }

  // ---------- Photo-first wizard -------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (currentStep > 0) {
              setCurrentStep(currentStep - 1);
            } else {
              router.back();
            }
          }}
          className="p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">授業記録</h1>
      </div>

      {/* Stepper */}
      {renderStepper()}

      {/* ================================================================= */}
      {/* Step 1: Student Selection                                         */}
      {/* ================================================================= */}
      {currentStep === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">生徒を選択してください</p>
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => {
                setSelectedStudent(student);
                setCurrentStep(1);
              }}
              className="w-full text-left bg-card rounded-xl border border-border p-4
                       hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <span className="font-semibold">{student.name}</span>
              <span className="text-xs text-text-muted ml-2 bg-surface px-2 py-0.5 rounded-full">
                {student.grade}
              </span>
            </button>
          ))}

          {/* Manual mode link — visible after student selection */}
          {selectedStudent && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                写真を使わず手動で入力する →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 2: Photo Capture + Date                                      */}
      {/* ================================================================= */}
      {currentStep === 1 && selectedStudent && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            <span className="font-medium text-text">
              {selectedStudent.name}
            </span>{" "}
            の答案を撮影
          </p>

          {/* Camera / Upload area */}
          {!imagePreview ? (
            <label
              className="block bg-card rounded-xl border-2 border-dashed border-border
                          p-12 text-center cursor-pointer hover:border-primary/30 transition-colors"
            >
              <Camera size={40} className="mx-auto text-text-muted mb-3" />
              <p className="text-sm font-medium text-text mb-1">
                タップして撮影
              </p>
              <p className="text-xs text-text-muted">または画像を選択</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="bg-card rounded-xl border border-border p-3">
              <Image
                src={imagePreview}
                alt="答案プレビュー"
                width={400}
                height={300}
                className="w-full rounded-lg object-contain max-h-64"
                unoptimized
              />
              <label className="block mt-2 text-center">
                <span className="text-sm text-primary font-medium cursor-pointer hover:underline">
                  撮り直す
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Date picker */}
          {renderDatePicker()}

          {/* Analyze button */}
          <button
            onClick={analyzeImage}
            disabled={!imageFile || analyzing}
            className="w-full py-3 rounded-lg bg-primary text-white font-medium
                     hover:bg-primary-dark transition-all disabled:opacity-50
                     flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                解析中...
              </>
            ) : (
              "解析する"
            )}
          </button>

          {/* Manual mode link also available here */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              手動入力に切り替える →
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 3: Confirmation & Save                                       */}
      {/* ================================================================= */}
      {currentStep === 2 && selectedStudent && (
        <div className="space-y-4">
          {/* Image thumbnail */}
          {imagePreview && (
            <div className="bg-card rounded-xl border border-border p-3">
              <Image
                src={imagePreview}
                alt="答案"
                width={400}
                height={200}
                className="w-full rounded-lg object-contain max-h-40"
                unoptimized
              />
            </div>
          )}

          {/* AI result confidence display */}
          {aiResult && (
            <div
              className={`rounded-xl border p-4 ${
                aiResult.confidence >= 0.7
                  ? "bg-primary/5 border-primary/20"
                  : aiResult.confidence >= 0.5
                  ? "bg-warning/5 border-warning/20"
                  : "bg-danger/5 border-danger/20"
              }`}
            >
              <p className="text-xs font-medium text-primary mb-2">
                AI解析結果
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 w-20 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        aiResult.confidence >= 0.7
                          ? "bg-success"
                          : aiResult.confidence >= 0.5
                          ? "bg-warning"
                          : "bg-danger"
                      }`}
                      style={{ width: `${aiResult.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted tabular-nums">
                    信頼度 {Math.round(aiResult.confidence * 100)}%
                  </span>
                </div>
              </div>
              <div className="mt-2 text-xs text-text-muted space-y-0.5">
                <p>読取: 科目「{aiResult.subject_name ?? "—"}」 教材「{aiResult.content_group_name ?? "—"}」</p>
                <p>単元「{aiResult.unit_name ?? "—"}」 ステップ「{aiResult.step_type ?? "—"}」</p>
              </div>
              {showYellowWarning && (
                <div className="flex items-center gap-1.5 mt-2 text-warning text-xs">
                  <AlertTriangle size={14} />
                  信頼度がやや低いため、内容を確認してください
                </div>
              )}
              {shouldExpandManual && (
                <div className="flex items-center gap-1.5 mt-2 text-danger text-xs">
                  <AlertTriangle size={14} />
                  解析精度が低いため、手動で選択してください
                </div>
              )}
            </div>
          )}

          {/* AI error message */}
          {aiError && (
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
              <div className="flex items-center gap-1.5 text-danger text-xs">
                <AlertTriangle size={14} />
                AI解析に失敗しました。手動で入力してください
              </div>
              {aiErrorMsg && (
                <p className="text-xs text-text-muted mt-1 break-all">{aiErrorMsg}</p>
              )}
            </div>
          )}

          {/* Editable fields */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
              以下すべて修正可能
            </p>

            {renderManualSelectors()}

            {/* Date */}
            {renderDatePicker()}
          </div>

          {/* Score inputs */}
          {renderScoreInputs()}

          {/* Validation messages */}
          {!selectedSubjectId && (
            <p className="text-xs text-danger">科目を選択してください</p>
          )}
          {selectedSubjectId && !selectedContentGroupId && (
            <p className="text-xs text-danger">教材を選択してください</p>
          )}
          {selectedContentGroupId && !selectedUnit && (
            <p className="text-xs text-danger">単元を選択してください</p>
          )}

          {/* Save + Continue buttons (directly after score inputs) */}
          <div className="space-y-3">
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold
                       hover:bg-primary-dark active:scale-[0.98] transition-all
                       disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} />
              )}
              保存する
            </button>
            <button
              onClick={handleContinue}
              className="w-full py-3 rounded-lg border border-border text-text font-medium
                       hover:bg-surface transition-all"
            >
              続けて記録する
            </button>
          </div>

          {/* Recommendations (reference, below action buttons) */}
          {renderRecommendations()}
        </div>
      )}
    </div>
  );
}
