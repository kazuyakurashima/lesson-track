import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PenSquare, ChevronRight, AlertTriangle } from "lucide-react";

interface StudentRow {
  id: string;
  name: string;
  grade: string;
  enrollment_type: string;
}

interface RecordRow {
  id: string;
  lesson_date: string;
  step_type: string;
  score: number | null;
  max_score: number | null;
  completion_type: string | null;
  students: { name: string };
  units: { name: string };
  users: { display_name: string };
}

interface StudentSubjectRow {
  student_id: string;
  subjects: { id: string };
}

interface ContentGroupRow {
  id: string;
  subject_id: string;
}

interface UnitRow {
  id: string;
  content_group_id: string;
}

interface CompletedRecordRow {
  student_id: string;
  unit_id: string;
  completion_type: string | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: students } = (await supabase
    .from("students")
    .select("id, name, grade, enrollment_type")
    .eq("is_active", true)
    .order("name")) as { data: StudentRow[] | null };

  const { data: recentRecords } = (await supabase
    .from("lesson_records")
    .select(
      `id, lesson_date, step_type, score, max_score, completion_type,
       students!inner(name),
       units!inner(name),
       users!inner(display_name)`
    )
    .order("created_at", { ascending: false })
    .limit(5)) as { data: RecordRow[] | null };

  const { data: allRecords } = (await supabase
    .from("lesson_records")
    .select("student_id, unit_id, completion_type")
    .not("completion_type", "is", null)) as { data: CompletedRecordRow[] | null };

  const { data: studentSubjects } = (await supabase
    .from("student_subjects")
    .select("student_id, subjects!inner(id)")) as { data: StudentSubjectRow[] | null };

  // Get content groups and units via content_groups
  const { data: allContentGroups } = (await supabase
    .from("content_groups")
    .select("id, subject_id")) as { data: ContentGroupRow[] | null };

  const { data: allUnits } = (await supabase
    .from("units")
    .select("id, content_group_id")) as { data: UnitRow[] | null };

  // Calculate progress per student
  const progressMap = new Map<string, { completed: number; total: number }>();
  if (students && allRecords && studentSubjects && allContentGroups && allUnits) {
    for (const student of students) {
      const subjectIds = studentSubjects
        .filter((ss) => ss.student_id === student.id)
        .map((ss) => ss.subjects.id);

      // Get content group IDs for the student's subjects
      const cgIds = allContentGroups
        .filter((cg) => subjectIds.includes(cg.subject_id))
        .map((cg) => cg.id);

      // Count units belonging to those content groups
      const totalUnits = allUnits.filter((u) =>
        cgIds.includes(u.content_group_id)
      ).length;

      const studentUnitIds = new Set(
        allUnits
          .filter((u) => cgIds.includes(u.content_group_id))
          .map((u) => u.id)
      );

      const completedUnitIds = new Set(
        allRecords
          .filter((r) => r.student_id === student.id && r.completion_type && studentUnitIds.has(r.unit_id))
          .map((r) => r.unit_id)
      );

      progressMap.set(student.id, {
        completed: completedUnitIds.size,
        total: totalUnits,
      });
    }
  }

  const enrollmentLabel = (type: string) => {
    switch (type) {
      case "spring_course":
        return "春期講習";
      case "ongoing":
        return "継続受講";
      case "trial":
        return "体験";
      default:
        return type;
    }
  };

  const stepLabel = (type: string) => {
    switch (type) {
      case "learning":
        return "L";
      case "step1":
        return "S1";
      case "step2":
        return "S2";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-8">
      {/* Quick Action */}
      <section>
        <Link
          href="/record"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-xl
                     bg-primary text-white font-semibold text-base
                     hover:bg-primary-dark active:scale-[0.98] transition-all shadow-sm"
        >
          <PenSquare size={20} />
          授業を記録する
        </Link>
      </section>

      {/* Students */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">生徒一覧</h2>
          <Link
            href="/students"
            className="text-sm text-primary font-medium hover:underline"
          >
            すべて見る
          </Link>
        </div>

        {!students || students.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted">生徒が登録されていません</p>
            <Link
              href="/students/new"
              className="inline-block mt-3 text-primary font-medium text-sm hover:underline"
            >
              生徒を登録する
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((student) => {
              const progress = progressMap.get(student.id);
              const pct =
                progress && progress.total > 0
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0;

              return (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="block bg-card rounded-xl border border-border p-4
                           hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{student.name}</span>
                      <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
                        {student.grade}
                      </span>
                      <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
                        {enrollmentLabel(student.enrollment_type)}
                      </span>
                    </div>
                    <ChevronRight size={18} className="text-text-muted" />
                  </div>
                  {progress && progress.total > 0 && (
                    <div className="flex items-center gap-3">
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
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Records */}
      <section>
        <h2 className="text-lg font-semibold mb-3">最近の記録</h2>

        {!recentRecords || recentRecords.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-text-muted">まだ記録がありません</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {recentRecords.map((record) => {
              const isBelowThreshold =
                record.score !== null &&
                record.max_score !== null &&
                record.max_score > 0 &&
                record.score / record.max_score < 0.8;

              return (
                <div key={record.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-text-muted tabular-nums">
                        {record.lesson_date}
                      </span>
                      <span className="font-medium text-sm truncate">
                        {record.students?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.score !== null && (
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            isBelowThreshold ? "text-warning" : "text-text"
                          }`}
                        >
                          {record.score}/{record.max_score}
                        </span>
                      )}
                      {isBelowThreshold && (
                        <AlertTriangle size={14} className="text-warning" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted">
                      {record.units?.name}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface text-text-muted font-medium">
                      {stepLabel(record.step_type)}
                    </span>
                    <span className="text-xs text-text-muted ml-auto">
                      {record.users?.display_name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
