import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PenSquare, ChevronRight, AlertTriangle, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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
  units: { name: string; content_group_id: string };
  users: { display_name: string };
}

interface StudentSubjectRow {
  student_id: string;
  subjects: { id: string };
}

interface ContentGroupRow {
  id: string;
  subject_id: string;
  name: string;
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

interface RecentRecordRow {
  student_id: string;
  lesson_date: string;
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
       units!inner(name, content_group_id),
       users!inner(display_name)`
    )
    .order("created_at", { ascending: false })
    .limit(8)) as { data: RecordRow[] | null };

  const { data: allRecords } = (await supabase
    .from("lesson_records")
    .select("student_id, unit_id, completion_type")
    .not("completion_type", "is", null)) as { data: CompletedRecordRow[] | null };

  const { data: studentSubjects } = (await supabase
    .from("student_subjects")
    .select("student_id, subjects!inner(id)")) as { data: StudentSubjectRow[] | null };

  const { data: allContentGroups } = (await supabase
    .from("content_groups")
    .select("id, subject_id, name")) as { data: ContentGroupRow[] | null };

  const { data: allUnits } = (await supabase
    .from("units")
    .select("id, content_group_id")) as { data: UnitRow[] | null };

  // Last lesson date per student
  const { data: lastLessons } = (await supabase
    .from("lesson_records")
    .select("student_id, lesson_date")
    .order("lesson_date", { ascending: false })) as { data: RecentRecordRow[] | null };

  const lastLessonMap = new Map<string, string>();
  if (lastLessons) {
    for (const l of lastLessons) {
      if (!lastLessonMap.has(l.student_id)) {
        lastLessonMap.set(l.student_id, l.lesson_date);
      }
    }
  }

  // Content group name lookup
  const cgNameMap = new Map<string, string>();
  if (allContentGroups) {
    for (const cg of allContentGroups) {
      cgNameMap.set(cg.id, cg.name);
    }
  }

  // Progress per student
  const progressMap = new Map<string, { completed: number; total: number }>();
  if (students && allRecords && studentSubjects && allContentGroups && allUnits) {
    for (const student of students) {
      const subjectIds = studentSubjects
        .filter((ss) => ss.student_id === student.id)
        .map((ss) => ss.subjects.id);
      const cgIds = allContentGroups
        .filter((cg) => subjectIds.includes(cg.subject_id))
        .map((cg) => cg.id);
      const totalUnits = allUnits.filter((u) => cgIds.includes(u.content_group_id)).length;
      const studentUnitIds = new Set(
        allUnits.filter((u) => cgIds.includes(u.content_group_id)).map((u) => u.id)
      );
      const completedUnitIds = new Set(
        allRecords
          .filter((r) => r.student_id === student.id && r.completion_type && studentUnitIds.has(r.unit_id))
          .map((r) => r.unit_id)
      );
      progressMap.set(student.id, { completed: completedUnitIds.size, total: totalUnits });
    }
  }

  const enrollmentLabel = (type: string) => {
    switch (type) {
      case "spring_course": return "春期講習";
      case "ongoing": return "継続";
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

  return (
    <div className="space-y-8">
      {/* Quick Action — context-dependent sticky */}
      <Link
        href="/record"
        className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl
                   bg-primary text-primary-foreground font-semibold text-sm
                   shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25
                   active:translate-y-px transition-all"
      >
        <PenSquare className="h-4 w-4" />
        授業を記録する
      </Link>

      {/* Students — Card Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">生徒</h2>
          <Link
            href="/students"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
          >
            すべて見る
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!students || students.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">生徒が登録されていません</p>
              <Link href="/students/new" className="text-sm text-primary font-medium hover:underline">
                生徒を登録する
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {students.map((student) => {
              const progress = progressMap.get(student.id);
              const pct = progress && progress.total > 0
                ? Math.round((progress.completed / progress.total) * 100)
                : 0;
              const lastDate = lastLessonMap.get(student.id);

              return (
                <Link key={student.id} href={`/students/${student.id}`}>
                  <Card className="h-full hover:shadow-md hover:border-border transition-all duration-200 cursor-pointer group">
                    <CardContent className="py-4 space-y-3">
                      {/* Name + meta */}
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm leading-tight">{student.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                              {student.grade}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                              {enrollmentLabel(student.enrollment_type)}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-0.5" />
                      </div>

                      {/* Progress */}
                      {progress && progress.total > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              {progress.completed}/{progress.total} 単元完了
                            </span>
                            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      )}

                      {/* Last lesson */}
                      {lastDate && (
                        <p className="text-[11px] text-muted-foreground/70">
                          最終授業: {lastDate}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Records */}
      <section className="space-y-4">
        <h2 className="text-base font-bold tracking-tight">最近の記録</h2>

        {!recentRecords || recentRecords.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">まだ記録がありません</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {recentRecords.map((record, i) => {
                const isBelowThreshold =
                  record.score !== null &&
                  record.max_score !== null &&
                  record.max_score > 0 &&
                  record.score / record.max_score < 0.8;
                const cgName = cgNameMap.get(record.units?.content_group_id ?? "");

                return (
                  <div key={record.id}>
                    {i > 0 && <Separator />}
                    <div className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                            {record.lesson_date}
                          </span>
                          <span className="font-medium text-sm truncate">
                            {record.students?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {record.score !== null && (
                            <span className={`text-sm font-bold tabular-nums ${isBelowThreshold ? "text-amber-600" : "text-foreground"}`}>
                              {record.score}/{record.max_score}
                            </span>
                          )}
                          {isBelowThreshold && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {cgName && (
                          <span className="text-[11px] text-muted-foreground/60 truncate">
                            {cgName}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground truncate">
                          {record.units?.name}
                        </span>
                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-semibold shrink-0">
                          {stepLabel(record.step_type)}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground/60 ml-auto shrink-0">
                          {record.users?.display_name}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
