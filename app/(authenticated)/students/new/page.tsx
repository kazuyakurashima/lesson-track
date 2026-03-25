"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { EnrollmentType } from "@/lib/types/supabase";

interface Subject {
  id: string;
  name: string;
}

interface ContentGroup {
  id: string;
  subject_id: string;
  name: string;
  display_order: number;
}

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [contentGroups, setContentGroups] = useState<ContentGroup[]>([]);

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("中1");
  const [enrollmentType, setEnrollmentType] =
    useState<EnrollmentType>("ongoing");
  const [scheduleNote, setScheduleNote] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedContentGroups, setSelectedContentGroups] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("subjects").select("id, name").order("display_order"),
      supabase.from("content_groups").select("id, subject_id, name, display_order").order("display_order"),
    ]).then(([subjectsRes, cgsRes]) => {
      if (subjectsRes.data) setSubjects(subjectsRes.data);
      if (cgsRes.data) setContentGroups(cgsRes.data as ContentGroup[]);
    });
  }, []);

  function toggleSubject(subjectId: string) {
    setSelectedSubjects((prev) => {
      if (prev.includes(subjectId)) {
        const cgIds = contentGroups
          .filter((cg) => cg.subject_id === subjectId)
          .map((cg) => cg.id);
        setSelectedContentGroups((prevCGs) =>
          prevCGs.filter((id) => !cgIds.includes(id))
        );
        return prev.filter((s) => s !== subjectId);
      }
      return [...prev, subjectId];
    });
  }

  function toggleContentGroup(cgId: string) {
    setSelectedContentGroups((prev) =>
      prev.includes(cgId)
        ? prev.filter((id) => id !== cgId)
        : [...prev, cgId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("認証エラー");
      setLoading(false);
      return;
    }

    const { data: student, error: insertError } = await supabase
      .from("students")
      .insert({
        name: name.trim(),
        grade,
        enrollment_type: enrollmentType,
        schedule_note: scheduleNote.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !student) {
      setError("登録に失敗しました");
      setLoading(false);
      return;
    }

    // Link selected subjects
    if (selectedSubjects.length > 0) {
      const { error: subjectError } = await supabase
        .from("student_subjects")
        .insert(
          selectedSubjects.map((subjectId) => ({
            student_id: student.id,
            subject_id: subjectId,
          }))
        );

      if (subjectError) {
        setError("科目の紐付けに失敗しました");
        setLoading(false);
        return;
      }
    }

    // Link selected content groups
    if (selectedContentGroups.length > 0) {
      const { error: cgError } = await supabase
        .from("student_content_groups")
        .insert(
          selectedContentGroups.map((cgId) => ({
            student_id: student.id,
            content_group_id: cgId,
          }))
        );

      if (cgError) {
        setError("コンテンツの紐付けに失敗しました");
        setLoading(false);
        return;
      }
    }

    router.push("/students");
    router.refresh();
  }

  const grades = ["中1", "中2", "中3"];
  const enrollmentTypes: { value: EnrollmentType; label: string }[] = [
    { value: "ongoing", label: "継続受講" },
    { value: "spring_course", label: "春期講習" },
    { value: "trial", label: "体験" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">生徒を追加</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              氏名 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                       placeholder:text-text-muted/50 focus:outline-none focus:ring-2
                       focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="例: 佐藤 太郎"
            />
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              学年
            </label>
            <div className="flex gap-2">
              {grades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    grade === g
                      ? "bg-primary text-white"
                      : "bg-surface text-text-muted hover:text-text"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Enrollment Type */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
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
                      : "bg-surface text-text-muted hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Note */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              スケジュールメモ
            </label>
            <input
              type="text"
              value={scheduleNote}
              onChange={(e) => setScheduleNote(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                       placeholder:text-text-muted/50 focus:outline-none focus:ring-2
                       focus:ring-primary/20 focus:border-primary transition-colors"
              placeholder="例: 週1回2時間"
            />
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
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
                      : "bg-surface text-text-muted hover:text-text"
                  }`}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </div>

          {/* Content Groups per selected subject */}
          {selectedSubjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                使用コンテンツ
              </label>
              <div className="space-y-3">
                {selectedSubjects.map((subjectId) => {
                  const subject = subjects.find((s) => s.id === subjectId);
                  const cgs = contentGroups.filter((cg) => cg.subject_id === subjectId);
                  if (!subject || cgs.length === 0) return null;
                  return (
                    <div key={subjectId} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        {subject.name}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {cgs.map((cg) => (
                          <button
                            key={cg.id}
                            type="button"
                            onClick={() => toggleContentGroup(cg.id)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              selectedContentGroups.includes(cg.id)
                                ? "bg-primary text-white"
                                : "bg-white border border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {cg.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-danger text-sm bg-danger-light rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-3 rounded-lg bg-primary text-white font-medium
                   hover:bg-primary-dark active:scale-[0.98] transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          登録する
        </button>
      </form>
    </div>
  );
}
