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

        // Build a map of date → record count for intensity
        const dateRecordCount = new Map<string, number>();
        allRecords.forEach((r) => {
          dateRecordCount.set(r.lesson_date, (dateRecordCount.get(r.lesson_date) ?? 0) + 1);
        });

        // Determine calendar month: show the month with most recent data, or current month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Collect months that have data
        const monthsWithData = [...new Set(lessonDates.map((d) => d.slice(0, 7)))].sort();
        // Default to current month, but also prepare prev/next navigation data
        const allMonths = new Set(monthsWithData);
        const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
        allMonths.add(currentMonthStr);

        // Show the latest month with data, or current month
        const displayMonthStr = monthsWithData.length > 0
          ? monthsWithData[monthsWithData.length - 1] > currentMonthStr
            ? monthsWithData[monthsWithData.length - 1]
            : currentMonthStr
          : currentMonthStr;

        const [dispYear, dispMonth] = displayMonthStr.split("-").map(Number);
        const firstDay = new Date(dispYear, dispMonth - 1, 1).getDay();
        const daysInMonth = new Date(dispYear, dispMonth, 0).getDate();
        const datesThisMonth = new Set(
          lessonDates.filter((d) => d.startsWith(displayMonthStr))
        );

        // Navigation months
        const prevMonthDate = new Date(dispYear, dispMonth - 2, 1);
        const nextMonthDate = new Date(dispYear, dispMonth, 1);
        const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
        const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
        const hasPrevData = monthsWithData.some((m) => m <= prevMonthStr);
        const hasNextData = nextMonthStr <= currentMonthStr;

        // Learning pace: units completed per week (last 4 weeks)
        const fourWeeksAgo = new Date(now);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const fourWeeksAgoStr = fourWeeksAgo.toISOString().slice(0, 10);
        const recentLearning = allRecords.filter(
          (r) => r.lesson_date >= fourWeeksAgoStr && r.step_type === "learning"
        );
        const totalLearning = allRecords.filter((r) => r.step_type === "learning").length;
        const weeklyPace =
          recentLearning.length > 0
            ? Math.round((recentLearning.length / 4) * 10) / 10
            : 0;
        const totalLessons = lessonDates.length;

        const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

        // Intensity: light/medium/strong based on record count
        function intensityClass(count: number): string {
          if (count >= 6) return "bg-primary text-white font-semibold";
          if (count >= 3) return "bg-primary/20 text-primary font-semibold";
          return "bg-primary/10 text-primary font-medium";
        }

        return (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Calendar */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  {hasPrevData ? (
                    <a
                      href={`?month=${prevMonthStr}`}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </a>
                  ) : (
                    <div className="w-6" />
                  )}
                  <CardTitle className="text-sm font-semibold">
                    {dispYear}年{dispMonth}月
                  </CardTitle>
                  {hasNextData ? (
                    <a
                      href={`?month=${nextMonthStr}`}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  ) : (
                    <div className="w-6" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-4">
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {/* Day header */}
                  {dayLabels.map((d, i) => (
                    <div
                      key={d}
                      className={`text-[10px] font-semibold py-1.5 ${
                        i === 0
                          ? "text-red-400"
                          : i === 6
                          ? "text-blue-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                  {/* Empty cells before first day */}
                  {Array.from({ length: firstDay }, (_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = `${displayMonthStr}-${String(day).padStart(2, "0")}`;
                    const hasLesson = datesThisMonth.has(dateStr);
                    const recordCount = dateRecordCount.get(dateStr) ?? 0;
                    const dayOfWeek = new Date(dispYear, dispMonth - 1, day).getDay();
                    const isToday =
                      day === now.getDate() &&
                      dispMonth - 1 === now.getMonth() &&
                      dispYear === now.getFullYear();

                    return (
                      <div
                        key={day}
                        className="aspect-square flex items-center justify-center"
                      >
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors ${
                            hasLesson
                              ? intensityClass(recordCount)
                              : isToday
                              ? "ring-2 ring-primary ring-offset-1 font-bold text-primary"
                              : dayOfWeek === 0
                              ? "text-red-400/70"
                              : dayOfWeek === 6
                              ? "text-blue-400/70"
                              : "text-foreground/80"
                          }`}
                        >
                          {day}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/10" />
                    <span className="text-[10px] text-muted-foreground">少</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary/30" />
                    <span className="text-[10px] text-muted-foreground">中</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-[10px] text-muted-foreground">多</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full ring-2 ring-primary ring-offset-1" />
                    <span className="text-[10px] text-muted-foreground">今日</span>
                  </div>
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
                  <span className="text-3xl font-bold tabular-nums tracking-tight">
                    {weeklyPace > 0 ? weeklyPace : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    単元/週
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-2">直近4週間の平均</p>
                <Separator />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">授業実施日数</span>
                    <span className="text-sm font-semibold tabular-nums">{totalLessons}日</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">学習済み単元</span>
                    <span className="text-sm font-semibold tabular-nums">{totalLearning}単元</span>
                  </div>
                  {weeklyPace > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">月あたり推定</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {Math.round(weeklyPace * 4.3)}単元/月
                        </span>
                      </div>
                    </>
                  )}
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
