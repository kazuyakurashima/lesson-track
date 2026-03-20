import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Disc,
  ChevronRight,
  Pencil,
} from "lucide-react";
import type { ContentCategory } from "@/lib/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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

  const contentGroupIds = (allContentGroups ?? []).map((cg) => cg.id);
  const { data: allUnits } = (await supabase
    .from("units")
    .select("id, name, unit_number, content_group_id")
    .in("content_group_id", contentGroupIds.length > 0 ? contentGroupIds : ["_none_"])
    .order("unit_number")) as {
    data: Array<{ id: string; name: string; unit_number: number; content_group_id: string }> | null;
  };

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
            status = hasStep2 ? "retest" : "in_progress";
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
        return <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />;
      case "retest":
        return <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />;
      case "in_progress":
        return <Disc className="h-4.5 w-4.5 text-primary" />;
      case "not_started":
        return <Circle className="h-4.5 w-4.5 text-muted-foreground/30" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/students"
          className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">{student.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{student.grade}</Badge>
            <Badge variant="outline">{enrollmentLabel(student.enrollment_type)}</Badge>
            {student.schedule_note && (
              <span className="text-xs text-muted-foreground">{student.schedule_note}</span>
            )}
          </div>
        </div>
        <Link
          href={`/students/${id}/edit`}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <Pencil className="h-5 w-5" />
        </Link>
      </div>

      {/* Calendar + Learning Pace */}
      {(() => {
        const allRecords = records ?? [];
        const lessonDates = [...new Set(allRecords.map((r) => r.lesson_date))].sort();

        // Calendar: current month
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
        const datesThisMonth = new Set(
          lessonDates.filter((d) => d.startsWith(monthStr))
        );

        // Learning pace: units completed per week (last 4 weeks)
        const fourWeeksAgo = new Date(now);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const fourWeeksAgoStr = fourWeeksAgo.toISOString().slice(0, 10);
        const recentLearning = allRecords.filter(
          (r) => r.lesson_date >= fourWeeksAgoStr && r.step_type === "learning"
        );
        const weeklyPace =
          recentLearning.length > 0
            ? Math.round((recentLearning.length / 4) * 10) / 10
            : 0;
        const totalLessons = lessonDates.length;

        const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

        return (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Mini Calendar */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">
                  {year}年{month + 1}月
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-7 gap-1 text-center">
                  {dayLabels.map((d) => (
                    <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: firstDay }, (_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
                    const hasLesson = datesThisMonth.has(dateStr);
                    const isToday =
                      day === now.getDate() &&
                      month === now.getMonth() &&
                      year === now.getFullYear();

                    return (
                      <div
                        key={day}
                        className={`relative text-xs py-1.5 rounded-md ${
                          isToday
                            ? "font-bold text-primary"
                            : "text-foreground"
                        }`}
                      >
                        {day}
                        {hasLesson && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Learning Pace */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">学習ペース</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {weeklyPace > 0 ? weeklyPace : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    単元/週（直近4週）
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">授業実施日数</span>
                  <span className="font-medium tabular-nums">{totalLessons}日</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">学習済み単元</span>
                  <span className="font-medium tabular-nums">{recentLearning.length > 0 ? allRecords.filter((r) => r.step_type === "learning").length : 0}単元</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Subject sections with content groups */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">受講科目が設定されていません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {subjects.map((subject) => {
            const cgProgressList = buildContentGroupProgress(subject.id);

            return (
              <section key={subject.id} className="space-y-3">
                <h2 className="text-base font-bold tracking-tight text-foreground">{subject.name}</h2>

                {cgProgressList.map((cgProgress) => {
                  const pct =
                    cgProgress.totalCount > 0
                      ? Math.round((cgProgress.completedCount / cgProgress.totalCount) * 100)
                      : 0;

                  return (
                    <Card key={cgProgress.contentGroupId} className="overflow-hidden">
                      <details className="group">
                        <summary className="cursor-pointer list-none">
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
                                <CardTitle className="text-sm font-semibold">
                                  {cgProgress.contentGroupName}
                                </CardTitle>
                              </div>
                              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                {cgProgress.completedCount}/{cgProgress.totalCount}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 ml-6">
                              <Progress value={pct} className="h-1.5 flex-1" />
                              <span className="text-xs font-medium tabular-nums text-muted-foreground w-10 text-right">
                                {pct}%
                              </span>
                            </div>
                          </CardHeader>
                        </summary>

                        <Separator />
                        <CardContent className="p-0">
                          {cgProgress.units.map((unit, i) => (
                            <div key={unit.unitId}>
                              {i > 0 && <Separator />}
                              <div className="px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                  <StatusIcon status={unit.status} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate leading-tight">
                                      {unit.unitName}
                                    </p>
                                    {unit.records.length > 0 && (
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {unit.records.map((r, j) => (
                                          <span
                                            key={j}
                                            className="text-[11px] text-muted-foreground tabular-nums inline-flex items-center gap-1"
                                          >
                                            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-semibold">
                                              {stepLabel(r.stepType)}
                                            </Badge>
                                            {r.score !== null
                                              ? `${r.score}/${r.maxScore}`
                                              : "配布"}
                                            <span className="text-muted-foreground/50">
                                              {r.date}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </details>
                    </Card>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
