import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Circle, Disc, ChevronDown, ChevronRight } from "lucide-react";
import type { ContentCategory } from "@/lib/types/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

type UnitStatus = "completed" | "retest" | "in_progress" | "not_started";

interface UnitProgress {
  unitId: string;
  unitName: string;
  unitNumber: number;
  status: UnitStatus;
  records: Array<{
    stepType: string;
    score: number | null;
    maxScore: number | null;
    date: string;
    instructor: string;
    completionType: string | null;
  }>;
}

interface ContentGroupProgress {
  contentGroupId: string;
  contentGroupName: string;
  category: ContentCategory;
  units: UnitProgress[];
  completedCount: number;
  totalCount: number;
}

export default async function StudentDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = (await supabase
    .from("students")
    .select("id, name, grade, enrollment_type, schedule_note")
    .eq("id", id)
    .single()) as {
    data: {
      id: string;
      name: string;
      grade: string;
      enrollment_type: string;
      schedule_note: string | null;
    } | null;
  };

  if (!student) notFound();

  // Get student's subjects
  const { data: studentSubjects } = (await supabase
    .from("student_subjects")
    .select("subject_id, subjects(id, name, display_order)")
    .eq("student_id", id)) as {
    data: Array<{
      subject_id: string;
      subjects: { id: string; name: string; display_order: number };
    }> | null;
  };

  const subjects = (studentSubjects ?? [])
    .map((ss) => ss.subjects)
    .sort((a, b) => a.display_order - b.display_order);

  // Get all content groups for the student's subjects
  const subjectIds = subjects.map((s) => s.id);
  const { data: allContentGroups } = (await supabase
    .from("content_groups")
    .select("id, subject_id, name, category, display_order")
    .in("subject_id", subjectIds.length > 0 ? subjectIds : ["_none_"])
    .order("display_order")) as {
    data: Array<{
      id: string;
      subject_id: string;
      name: string;
      category: ContentCategory;
      display_order: number;
    }> | null;
  };

  // Get all units for the content groups
  const contentGroupIds = (allContentGroups ?? []).map((cg) => cg.id);
  const { data: allUnits } = (await supabase
    .from("units")
    .select("id, name, unit_number, content_group_id")
    .in("content_group_id", contentGroupIds.length > 0 ? contentGroupIds : ["_none_"])
    .order("unit_number")) as {
    data: Array<{ id: string; name: string; unit_number: number; content_group_id: string }> | null;
  };

  // Get all records for this student
  const { data: records } = (await supabase
    .from("lesson_records")
    .select(
      `id, unit_id, step_type, score, max_score, lesson_date, completion_type,
       users!inner(display_name)`
    )
    .eq("student_id", id)
    .order("lesson_date", { ascending: true })) as {
    data: Array<{
      id: string;
      unit_id: string;
      step_type: string;
      score: number | null;
      max_score: number | null;
      lesson_date: string;
      completion_type: string | null;
      users: { display_name: string };
    }> | null;
  };

  // Build progress per content group within a subject
  function buildContentGroupProgress(subjectId: string): ContentGroupProgress[] {
    const subjectCGs = (allContentGroups ?? []).filter((cg) => cg.subject_id === subjectId);
    const studentRecords = records ?? [];

    return subjectCGs.map((cg) => {
      const cgUnits = (allUnits ?? []).filter((u) => u.content_group_id === cg.id);

      const unitProgressList: UnitProgress[] = cgUnits.map((unit) => {
        const unitRecords = studentRecords
          .filter((r) => r.unit_id === unit.id)
          .map((r) => ({
            stepType: r.step_type,
            score: r.score,
            maxScore: r.max_score,
            date: r.lesson_date,
            instructor: r.users?.display_name ?? "",
            completionType: r.completion_type,
          }));

        let status: UnitStatus = "not_started";
        if (unitRecords.length > 0) {
          const hasCompleted = unitRecords.some(
            (r) => r.completionType === "passed" || r.completionType === "step1_perfect"
          );
          if (hasCompleted) {
            status = "completed";
          } else {
            const hasStep2 = unitRecords.some((r) => r.stepType === "step2");
            if (hasStep2) {
              status = "retest";
            } else {
              status = "in_progress";
            }
          }
        }

        return {
          unitId: unit.id,
          unitName: unit.name,
          unitNumber: unit.unit_number,
          status,
          records: unitRecords,
        };
      });

      const completedCount = unitProgressList.filter((p) => p.status === "completed").length;

      return {
        contentGroupId: cg.id,
        contentGroupName: cg.name,
        category: cg.category,
        units: unitProgressList,
        completedCount,
        totalCount: unitProgressList.length,
      };
    });
  }

  const enrollmentLabel = (type: string) => {
    switch (type) {
      case "spring_course": return "春期講習";
      case "ongoing": return "継続受講";
      case "trial": return "体験";
      default: return type;
    }
  };

  const stepLabel = (type: string) => {
    switch (type) {
      case "learning": return "L";
      case "step1": return "S1";
      case "step2": return "S2";
      default: return type;
    }
  };

  const StatusIcon = ({ status }: { status: UnitStatus }) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={18} className="text-success" />;
      case "retest":
        return <AlertTriangle size={18} className="text-warning" />;
      case "in_progress":
        return <Disc size={18} className="text-primary" />;
      case "not_started":
        return <Circle size={18} className="text-border" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/students"
          className="p-2 -ml-2 text-text-muted hover:text-text rounded-lg hover:bg-surface transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">{student.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
              {student.grade}
            </span>
            <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
              {enrollmentLabel(student.enrollment_type)}
            </span>
            {student.schedule_note && (
              <span className="text-xs text-text-muted">
                {student.schedule_note}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Subject sections with content groups */}
      {subjects.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">受講科目が設定されていません</p>
        </div>
      ) : (
        <div className="space-y-6">
          {subjects.map((subject) => {
            const cgProgressList = buildContentGroupProgress(subject.id);

            return (
              <div key={subject.id} className="space-y-3">
                <h2 className="text-lg font-semibold">{subject.name}</h2>

                {cgProgressList.map((cgProgress) => {
                  const pct =
                    cgProgress.totalCount > 0
                      ? Math.round((cgProgress.completedCount / cgProgress.totalCount) * 100)
                      : 0;

                  return (
                    <details
                      key={cgProgress.contentGroupId}
                      className="bg-card rounded-xl border border-border overflow-hidden group"
                    >
                      {/* Content group header */}
                      <summary className="px-4 py-3 cursor-pointer list-none">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              size={16}
                              className="text-text-muted transition-transform group-open:rotate-90"
                            />
                            <h3 className="font-medium text-sm">{cgProgress.contentGroupName}</h3>
                          </div>
                          <span className="text-xs text-text-muted tabular-nums">
                            {cgProgress.completedCount}/{cgProgress.totalCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 ml-6">
                          <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 80
                                  ? "bg-success"
                                  : pct >= 50
                                  ? "bg-primary"
                                  : "bg-warning"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted tabular-nums w-10 text-right">
                            {pct}%
                          </span>
                        </div>
                      </summary>

                      {/* Unit list */}
                      <div className="divide-y divide-border border-t border-border">
                        {cgProgress.units.map((unit) => (
                          <div key={unit.unitId} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <StatusIcon status={unit.status} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {unit.unitName}
                                </p>
                                {unit.records.length > 0 && (
                                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    {unit.records.map((r, i) => (
                                      <span
                                        key={i}
                                        className="text-xs text-text-muted tabular-nums"
                                      >
                                        <span className="inline-block bg-surface px-1 rounded mr-1">
                                          {stepLabel(r.stepType)}
                                        </span>
                                        {r.score !== null
                                          ? `${r.score}/${r.maxScore}`
                                          : "配布"}
                                        <span className="ml-1 text-text-muted/60">
                                          {r.date} {r.instructor}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
