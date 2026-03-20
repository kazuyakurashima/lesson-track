"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { ArrowLeft, Camera, Check, Loader2, AlertTriangle, Zap } from "lucide-react";
import type { StepType, ContentCategory } from "@/lib/types/supabase";

interface Student {
  id: string;
  name: string;
  grade: string;
}

interface Subject {
  id: string;
  name: string;
}

interface ContentGroup {
  id: string;
  subject_id: string;
  name: string;
  category: ContentCategory;
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

const STEPS = ["生徒", "単元", "撮影", "確認"] as const;

export default function RecordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Student
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Step 2: Unit
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [contentGroups, setContentGroups] = useState<ContentGroup[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedContentGroupId, setSelectedContentGroupId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedStepType, setSelectedStepType] = useState<StepType>("step1");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Step 3: Photo
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [, setSkipPhoto] = useState(false);

  // Step 4: Confirm
  const [score, setScore] = useState<string>("");
  const [maxScore, setMaxScore] = useState<string>("100");
  const [comment, setComment] = useState("");
  const [aiResult, setAiResult] = useState<{
    score: number;
    maxScore: number;
    confidence: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

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
      .select("subject_id, subjects(id, name)")
      .eq("student_id", selectedStudent.id)
      .then(({ data }) => {
        if (data) {
          const rows = data as unknown as Array<{ subjects: Subject }>;
          const subs = rows.map((d) => d.subjects);
          setSubjects(subs);
          if (subs.length > 0) setSelectedSubjectId(subs[0].id);
        }
      });
  }, [selectedStudent, supabase]);

  // Load content groups when subject selected
  useEffect(() => {
    if (!selectedSubjectId) return;

    supabase
      .from("content_groups")
      .select("id, subject_id, name, category")
      .eq("subject_id", selectedSubjectId)
      .order("display_order")
      .then(({ data }) => {
        if (data) {
          setContentGroups(data as ContentGroup[]);
          if (data.length > 0) setSelectedContentGroupId(data[0].id);
          else setSelectedContentGroupId("");
        }
      });
  }, [selectedSubjectId, supabase]);

  // Load units when content group selected
  useEffect(() => {
    if (!selectedContentGroupId) return;

    supabase
      .from("units")
      .select("id, name, unit_number, content_group_id")
      .eq("content_group_id", selectedContentGroupId)
      .order("unit_number")
      .then(({ data }) => {
        if (data) setUnits(data as Unit[]);
      });
  }, [selectedContentGroupId, supabase]);

  // Calculate recommendations
  const loadRecommendations = useCallback(async () => {
    if (!selectedStudent || subjects.length === 0) return;

    // Get all content groups for the student's subjects
    const subjectIds = subjects.map((s) => s.id);
    const { data: allContentGroups } = await supabase
      .from("content_groups")
      .select("id, subject_id, name, category")
      .in("subject_id", subjectIds)
      .order("display_order");

    if (!allContentGroups) return;

    const { data: records } = await supabase
      .from("lesson_records")
      .select("unit_id, step_type, score, max_score, completion_type")
      .eq("student_id", selectedStudent.id) as {
      data: Array<{
        unit_id: string;
        step_type: string;
        score: number | null;
        max_score: number | null;
        completion_type: string | null;
      }> | null;
    };

    if (!records) return;

    const recs: Recommendation[] = [];

    for (const cg of allContentGroups as ContentGroup[]) {
      const { data: cgUnits } = await supabase
        .from("units")
        .select("id, name, unit_number, content_group_id")
        .eq("content_group_id", cg.id)
        .order("unit_number") as { data: Unit[] | null };

      if (!cgUnits) continue;

      for (const unit of cgUnits) {
        const unitRecords = records.filter((r) => r.unit_id === unit.id);
        const hasLearning = unitRecords.some((r) => r.step_type === "learning");
        const hasStep1 = unitRecords.some((r) => r.step_type === "step1");
        const step2Records = unitRecords.filter((r) => r.step_type === "step2");
        const hasPassedStep2 = unitRecords.some(
          (r) => r.completion_type === "passed" || r.completion_type === "step1_perfect"
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
        if (cg.category === "vocabulary" && hasLearning && step2Records.length === 0) {
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
        if (cg.category === "academic" && hasStep1 && step2Records.length === 0) {
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

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setSkipPhoto(false);
  }

  async function analyzeImage() {
    if (!imageFile) return;
    setAnalyzing(true);

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAiResult({
          score: data.score,
          maxScore: data.max_score,
          confidence: data.confidence,
        });
        setScore(String(data.score));
        setMaxScore(String(data.max_score));
      }
    } catch {
      // AI analysis failed — user can enter manually
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!selectedStudent || !selectedUnit) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

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
        lesson_date: new Date().toISOString().split("T")[0],
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
      return;
    }

    // Upload image if exists
    if (imageFile) {
      const path = `${selectedStudent.id}/${record.id}/${imageFile.name}`;
      await supabase.storage.from("answer-sheets").upload(path, imageFile);

      await supabase.from("record_images").insert({
        record_id: record.id,
        storage_path: path,
        ai_extracted_score: aiResult?.score ?? null,
        ai_confidence: aiResult?.confidence ?? null,
      });
    }

    setSaving(false);
    router.push(`/students/${selectedStudent.id}`);
    router.refresh();
  }

  function handleRecommendationSelect(rec: Recommendation) {
    // Use subjectId from the recommendation directly (avoids lookup failure
    // when the recommendation is for a different subject than currently selected)
    setSelectedSubjectId(rec.subjectId);
    setSelectedContentGroupId(rec.contentGroupId);
    setSelectedUnit(rec.unit);
    setSelectedStepType(rec.stepType);
    setCurrentStep(2);
  }

  const currentContentGroup = contentGroups.find((c) => c.id === selectedContentGroupId);
  const stepTypes: { value: StepType; label: string }[] = [
    { value: "learning", label: "ラーニング" },
    { value: "step1", label: "ステップ1" },
    { value: "step2", label: "ステップ2" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            currentStep > 0 ? setCurrentStep(currentStep - 1) : router.back()
          }
          className="p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">授業記録</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
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

      {/* Step 1: Student Selection */}
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
        </div>
      )}

      {/* Step 2: Unit Selection */}
      {currentStep === 1 && selectedStudent && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            <span className="font-medium text-text">{selectedStudent.name}</span>{" "}
            の記録
          </p>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-secondary">
                <Zap size={16} />
                おすすめ
              </div>
              {recommendations.map((rec, i) => (
                <button
                  key={i}
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
          )}

          {/* Manual selection */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
              手動選択
            </p>

            {/* Subject tabs */}
            {subjects.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {subjects.map((sub) => (
                  <button
                    key={sub.id}
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
                {stepTypes.map(({ value, label }) => (
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

          <button
            onClick={() => setCurrentStep(2)}
            disabled={!selectedUnit}
            className="w-full py-3 rounded-lg bg-primary text-white font-medium
                     hover:bg-primary-dark transition-all disabled:opacity-50"
          >
            次へ
          </button>
        </div>
      )}

      {/* Step 3: Photo */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className="font-medium text-text">{selectedStudent?.name}</span>
            <span>・</span>
            <span>{currentContentGroup?.name}</span>
            <span>・</span>
            <span>{selectedUnit?.name}</span>
          </div>

          {/* Camera / Upload area */}
          {!imagePreview ? (
            <label className="block bg-card rounded-xl border-2 border-dashed border-border
                            p-12 text-center cursor-pointer hover:border-primary/30 transition-colors">
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

          <button
            onClick={() => {
              if (!imageFile) setSkipPhoto(true);
              setCurrentStep(3);
              if (imageFile) analyzeImage();
            }}
            className="w-full py-3 rounded-lg bg-primary text-white font-medium
                     hover:bg-primary-dark transition-all"
          >
            {imageFile ? "次へ" : "撮影せずに手動入力する"}
          </button>
        </div>
      )}

      {/* Step 4: Confirm & Save */}
      {currentStep === 3 && (
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

          {/* AI Result */}
          {analyzing && (
            <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="text-sm text-text-muted">AI解析中...</span>
            </div>
          )}

          {aiResult && (
            <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
              <p className="text-xs font-medium text-primary mb-2">
                AI読み取り結果
              </p>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold tabular-nums">
                  {aiResult.score} / {aiResult.maxScore}
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 w-20 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        aiResult.confidence >= 0.7 ? "bg-success" : "bg-warning"
                      }`}
                      style={{ width: `${aiResult.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted tabular-nums">
                    {Math.round(aiResult.confidence * 100)}%
                  </span>
                </div>
              </div>
              {aiResult.confidence < 0.7 && (
                <div className="flex items-center gap-1.5 mt-2 text-warning text-xs">
                  <AlertTriangle size={14} />
                  信頼度が低いため、点数を確認してください
                </div>
              )}
            </div>
          )}

          {/* Score input */}
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

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
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
      )}
    </div>
  );
}
