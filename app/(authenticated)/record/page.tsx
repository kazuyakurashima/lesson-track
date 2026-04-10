"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { StepType } from "@/lib/types/supabase";
import type {
  Student,
  ContentGroup,
  Unit,
  Recommendation,
  Mode,
} from "@/lib/types/lesson-record";
import { todayJST } from "@/lib/date-utils";
import { AI_CONFIDENCE_HIGH, AI_CONFIDENCE_MINIMUM } from "@/lib/constants";
import { calcCompletionType, calcScoreSource } from "@/lib/lesson-record-utils";
import { useStudentData } from "@/hooks/use-student-data";
import { useAiAnalysis } from "@/hooks/use-ai-analysis";
import { useRecommendations } from "@/hooks/use-recommendations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PHOTO_STEPS = ["生徒", "撮影", "確認"] as const;

const STEP_TYPE_OPTIONS: { value: StepType; label: string }[] = [
  { value: "learning", label: "ラーニング" },
  { value: "step1", label: "ステップ1" },
  { value: "step2", label: "ステップ2" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecordPage() {
  const router = useRouter();

  // ---- Mode ---------------------------------------------------------------
  const [mode, setMode] = useState<Mode>("photo");

  // ---- Wizard step (photo mode) ------------------------------------------
  const [currentStep, setCurrentStep] = useState(0);

  // ---- Student (shared) ---------------------------------------------------
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // ---- Master data (owned here, populated by hooks) -----------------------
  const [contentGroups, setContentGroups] = useState<ContentGroup[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // ---- Selections ---------------------------------------------------------
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedContentGroupId, setSelectedContentGroupId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedStepType, setSelectedStepType] = useState<StepType>("step1");
  const [lessonDate, setLessonDate] = useState(todayJST);

  // ---- Score / Save -------------------------------------------------------
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // =========================================================================
  // Custom hooks
  // =========================================================================

  const { supabase, aiLockRef, students, subjects, allContentGroups } =
    useStudentData(
      selectedStudent,
      selectedSubjectId,
      selectedContentGroupId,
      setContentGroups,
      setSelectedContentGroupId,
      setUnits,
    );

  const { recommendations, loadRecommendations } = useRecommendations(
    selectedStudent,
    subjects,
    supabase,
  );

  const {
    imageFile,
    setImageFile,
    imagePreview,
    setImagePreview,
    aiResult,
    setAiResult,
    analyzing,
    aiError,
    setAiError,
    aiErrorMsg,
    handleImageChange,
    analyzeImage,
  } = useAiAnalysis({
    supabase,
    aiLockRef,
    subjects,
    allContentGroups,
    recommendations,
    setSelectedSubjectId,
    setContentGroups,
    setSelectedContentGroupId,
    setUnits,
    setSelectedUnit,
    setSelectedStepType,
    setScore,
    setMaxScore,
    setCurrentStep,
  });

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

    const completionType = calcCompletionType(selectedStepType, scoreNum, maxScoreNum);
    const scoreSource = calcScoreSource(scoreNum, aiResult?.score);

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

  const shouldExpandManual =
    aiError ||
    (aiResult !== null &&
      (aiResult.confidence < AI_CONFIDENCE_MINIMUM ||
        !aiResult.subject_name ||
        !aiResult.content_group_name ||
        !aiResult.unit_name));

  const showYellowWarning =
    aiResult !== null &&
    aiResult.confidence >= AI_CONFIDENCE_MINIMUM &&
    aiResult.confidence < AI_CONFIDENCE_HIGH &&
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
        {selectedSubjectId && contentGroups.length === 0 && (
          <p className="text-xs text-text-muted">この科目には教材が未登録です</p>
        )}
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
                aiResult.confidence >= AI_CONFIDENCE_HIGH
                  ? "bg-primary/5 border-primary/20"
                  : aiResult.confidence >= AI_CONFIDENCE_MINIMUM
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
                        aiResult.confidence >= AI_CONFIDENCE_HIGH
                          ? "bg-success"
                          : aiResult.confidence >= AI_CONFIDENCE_MINIMUM
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
            <button
              onClick={() => {
                // Keep the same student, go back to photo step
                setCurrentStep(1);
                setImageFile(null);
                setImagePreview(null);
                setAiResult(null);
                setSelectedContentGroupId("");
                setSelectedUnit(null);
                setSelectedStepType("step1");
                setScore("");
                setMaxScore("");
                setComment("");
                setSaveError(null);
              }}
              className="w-full py-3 rounded-lg border border-dashed border-border text-muted-foreground text-sm
                       hover:bg-surface transition-all"
            >
              再撮影する
            </button>
          </div>

          {/* Recommendations (reference, below action buttons) */}
          {renderRecommendations()}
        </div>
      )}
    </div>
  );
}
