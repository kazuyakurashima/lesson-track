"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import type { EnrollmentType } from "@/lib/types/supabase";

interface Subject {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  name: string;
  grade: string;
  enrollment_type: EnrollmentType;
  schedule_note: string | null;
  is_active: boolean;
}

export default function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [student, setStudent] = useState<StudentData | null>(null);

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("中1");
  const [enrollmentType, setEnrollmentType] =
    useState<EnrollmentType>("ongoing");
  const [scheduleNote, setScheduleNote] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      // Load student
      const { data: studentData } = await supabase
        .from("students")
        .select("id, name, grade, enrollment_type, schedule_note, is_active")
        .eq("id", id)
        .single();

      if (!studentData) {
        router.push("/students");
        return;
      }

      setStudent(studentData as StudentData);
      setName(studentData.name);
      setGrade(studentData.grade);
      setEnrollmentType(studentData.enrollment_type as EnrollmentType);
      setScheduleNote(studentData.schedule_note ?? "");

      // Load all subjects
      const { data: allSubjects } = await supabase
        .from("subjects")
        .select("id, name")
        .order("display_order");
      if (allSubjects) setSubjects(allSubjects);

      // Load student's current subjects
      const { data: studentSubjects } = await supabase
        .from("student_subjects")
        .select("subject_id")
        .eq("student_id", id);
      if (studentSubjects) {
        setSelectedSubjects(studentSubjects.map((ss) => ss.subject_id));
      }

      setLoading(false);
    }

    load();
  }, [id, router]);

  function toggleSubject(subjectId: string) {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((s) => s !== subjectId)
        : [...prev, subjectId]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    const supabase = createClient();

    // Update student
    const { error: updateError } = await supabase
      .from("students")
      .update({
        name: name.trim(),
        grade,
        enrollment_type: enrollmentType,
        schedule_note: scheduleNote.trim() || null,
      })
      .eq("id", id);

    if (updateError) {
      setError("更新に失敗しました");
      setSaving(false);
      return;
    }

    // Update subjects: delete all, re-insert selected
    await supabase.from("student_subjects").delete().eq("student_id", id);

    if (selectedSubjects.length > 0) {
      const { error: subjectError } = await supabase
        .from("student_subjects")
        .insert(
          selectedSubjects.map((subjectId) => ({
            student_id: id,
            subject_id: subjectId,
          }))
        );

      if (subjectError) {
        setError("科目の更新に失敗しました");
        setSaving(false);
        return;
      }
    }

    router.push(`/students/${id}`);
    router.refresh();
  }

  async function handleDeactivate() {
    const supabase = createClient();

    const { error: deactivateError } = await supabase
      .from("students")
      .update({ is_active: false })
      .eq("id", id);

    if (deactivateError) {
      setError("無効化に失敗しました");
      return;
    }

    router.push("/students");
    router.refresh();
  }

  async function handleReactivate() {
    const supabase = createClient();

    const { error: reactivateError } = await supabase
      .from("students")
      .update({ is_active: true })
      .eq("id", id);

    if (reactivateError) {
      setError("有効化に失敗しました");
      return;
    }

    setStudent((prev) => (prev ? { ...prev, is_active: true } : null));
    setError("");
  }

  const grades = ["小4", "小5", "小6", "中1", "中2", "中3"];
  const enrollmentTypes: { value: EnrollmentType; label: string }[] = [
    { value: "ongoing", label: "継続受講" },
    { value: "spring_course", label: "春期講習" },
    { value: "trial", label: "体験" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">生徒を編集</h1>
      </div>

      {/* Deactivated banner */}
      {student && !student.is_active && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800 font-medium">
            この生徒は無効化されています
          </p>
          <button
            onClick={handleReactivate}
            className="text-sm text-amber-800 font-semibold underline hover:no-underline"
          >
            有効に戻す
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              氏名 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-foreground
                       placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2
                       focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="例: 佐藤 太郎"
            />
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              学年
            </label>
            <div className="flex gap-2 flex-wrap">
              {grades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    grade === g
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Enrollment Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              受講タイプ
            </label>
            <div className="flex gap-2 flex-wrap">
              {enrollmentTypes.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEnrollmentType(value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    enrollmentType === value
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Note */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              スケジュールメモ
            </label>
            <input
              type="text"
              value={scheduleNote}
              onChange={(e) => setScheduleNote(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-foreground
                       placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2
                       focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="例: 火曜日2回"
            />
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              受講科目
            </label>
            <div className="flex gap-2 flex-wrap">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => toggleSubject(subject.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedSubjects.includes(subject.id)
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3 rounded-lg bg-primary text-white font-medium
                   hover:bg-primary/90 active:scale-[0.98] transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          保存する
        </button>
      </form>

      {/* Deactivate section */}
      {student?.is_active && (
        <div className="border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">生徒の無効化</h3>
          <p className="text-xs text-muted-foreground">
            無効化すると一覧やダッシュボードに表示されなくなります。データは削除されません。
          </p>

          {!showDeactivateConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeactivateConfirm(true)}
              className="flex items-center gap-2 text-sm text-destructive hover:underline"
            >
              <Trash2 size={14} />
              無効化する
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDeactivate}
                className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-medium
                         hover:bg-destructive/90 transition-colors"
              >
                本当に無効化する
              </button>
              <button
                type="button"
                onClick={() => setShowDeactivateConfirm(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
