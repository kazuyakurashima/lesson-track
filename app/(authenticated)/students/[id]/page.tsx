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
  FileText,
} from "lucide-react";
import type { ContentCategory } from "@/lib/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import {
  currentMonthJST,
  daysAgoJST,
  formatYearMonth,
  parseYearMonth,
} from "@/lib/date-utils";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; day?: string }>;
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

export default async function StudentDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { month: monthParam, day: dayParam } = await searchParams;
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
        <div className="flex items-center gap-1">
          <a
            href={`/api/students/${id}/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            title="保護者レポート"
          >
            <FileText className="h-5 w-5" />
          </a>
          <Link
            href={`/students/${id}/edit`}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Pencil className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Calendar + Learning Pace */}
      {(() => {
        const allRecords = records ?? [];
        const lessonDates = [...new Set(allRecords.map((r) => r.lesson_date))].sort();

        // Build date → records map
        const dateRecordCount = new Map<string, number>();
        const dateRecordMap = new Map<string, typeof allRecords>();
        allRecords.forEach((r) => {
          dateRecordCount.set(r.lesson_date, (dateRecordCount.get(r.lesson_date) ?? 0) + 1);
          const arr = dateRecordMap.get(r.lesson_date) ?? [];
          arr.push(r);
          dateRecordMap.set(r.lesson_date, arr);
        });

        // JST-based calendar month from searchParams or current month
        const jstNow = currentMonthJST();
        const todayStr = daysAgoJST(0);
        const currentMonthStr = formatYearMonth(jstNow.year, jstNow.month);

        // Use searchParams.month if provided, otherwise current month
        const displayMonthStr = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
          ? monthParam
          : currentMonthStr;

        const { year: dispYear, month: dispMonth } = parseYearMonth(displayMonthStr);
        const firstDay = new Date(dispYear, dispMonth - 1, 1).getDay();
        const daysInMonth = new Date(dispYear, dispMonth, 0).getDate();
        const datesThisMonth = new Set(
          lessonDates.filter((d) => d.startsWith(displayMonthStr))
        );

        // Navigation months
        const prevMonth = dispMonth === 1
          ? formatYearMonth(dispYear - 1, 12)
          : formatYearMonth(dispYear, dispMonth - 1);
        const nextMonth = dispMonth === 12
          ? formatYearMonth(dispYear + 1, 1)
          : formatYearMonth(dispYear, dispMonth + 1);
        const canGoNext = nextMonth <= currentMonthStr;

        // Selected day from searchParams
        const selectedDay = dayParam && datesThisMonth.has(dayParam) ? dayParam : null;
        const selectedDayRecords = selectedDay ? (dateRecordMap.get(selectedDay) ?? []) : [];

        // Unit lookup for selected day records
        const unitMap = new Map((allUnits ?? []).map((u) => [u.id, u]));
        const cgMap = new Map((allContentGroups ?? []).map((cg) => [cg.id, cg]));

        // Learning pace: completion_type based, per content group
        const fourWeeksAgoStr = daysAgoJST(28);
        const totalLessons = lessonDates.length;

        // Per content-group pace
        const cgPaceList = (allContentGroups ?? []).map((cg) => {
          const cgUnits = (allUnits ?? []).filter((u) => u.content_group_id === cg.id);
          const cgUnitIds = new Set(cgUnits.map((u) => u.id));
          const cgRecords = allRecords.filter((r) => cgUnitIds.has(r.unit_id));

          // Completed = has completion_type that is not null
          const completedUnitIds = new Set(
            cgRecords.filter((r) => r.completion_type != null).map((r) => r.unit_id)
          );
          const completedCount = completedUnitIds.size;
          const totalCount = cgUnits.length;
          const remaining = totalCount - completedCount;

          // Recent completions (last 4 weeks)
          const recentCompleted = new Set(
            cgRecords
              .filter((r) => r.lesson_date >= fourWeeksAgoStr && r.completion_type != null)
              .map((r) => r.unit_id)
          ).size;
          const weeklyPace = recentCompleted > 0
            ? Math.round((recentCompleted / 4) * 10) / 10
            : 0;

          // Predicted completion date (year/month/旬)
          let predictedLabel: string | null = null;
          if (weeklyPace > 0 && remaining > 0) {
            const weeks = Math.ceil(remaining / weeklyPace);
            const todayParts = todayStr.split("-").map(Number);
            const target = new Date(todayParts[0], todayParts[1] - 1, todayParts[2] + weeks * 7);
            const tY = target.getFullYear();
            const tM = target.getMonth() + 1;
            const tD = target.getDate();
            const jun = tD <= 10 ? "上旬" : tD <= 20 ? "中旬" : "下旬";
            predictedLabel = `${tY}年${tM}月${jun}`;
          }

          return {
            name: cg.name,
            completedCount,
            totalCount,
            remaining,
            weeklyPace,
            predictedLabel,
          };
        }).filter((p) => p.totalCount > 0);

        const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

        function intensityClass(count: number): string {
          if (count >= 6) return "bg-primary text-white font-semibold";
          if (count >= 3) return "bg-primary/20 text-primary font-semibold";
          return "bg-primary/10 text-primary font-medium";
        }

        const stepLabel = (t: string) => {
          if (t === "learning") return "L";
          if (t === "step1") return "S1";
          if (t === "step2") return "S2";
          return t;
        };

        return (
          <div className="space-y-4">
            {/* Calendar */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`?month=${prevMonth}`}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </Link>
                  <CardTitle className="text-sm font-semibold">
                    {dispYear}年{dispMonth}月
                  </CardTitle>
                  {canGoNext ? (
                    <Link
                      href={`?month=${nextMonth}`}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <div className="w-6" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-4">
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {dayLabels.map((d, i) => (
                    <div
                      key={d}
                      className={`text-[10px] font-semibold py-1.5 ${
                        i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted-foreground"
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: firstDay }, (_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = `${displayMonthStr}-${String(day).padStart(2, "0")}`;
                    const hasLesson = datesThisMonth.has(dateStr);
                    const recordCount = dateRecordCount.get(dateStr) ?? 0;
                    const dayOfWeek = new Date(dispYear, dispMonth - 1, day).getDay();
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDay;

                    const cell = (
                      <div
                        className={`w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors ${
                          isSelected
                            ? "bg-primary text-white font-bold ring-2 ring-primary ring-offset-2"
                            : hasLesson
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
                    );

                    return (
                      <div key={day} className="aspect-square flex items-center justify-center">
                        {hasLesson ? (
                          <Link href={`?month=${displayMonthStr}&day=${dateStr}`}>
                            {cell}
                          </Link>
                        ) : (
                          cell
                        )}
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

            {/* Selected day records */}
            {selectedDay && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold">
                    {selectedDay} の授業記録（{selectedDayRecords.length}件）
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedDayRecords.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground text-center">記録なし</p>
                  ) : (
                    selectedDayRecords.map((r, i) => {
                      const unit = unitMap.get(r.unit_id);
                      const cg = unit ? cgMap.get(unit.content_group_id) : null;
                      return (
                        <div key={r.id}>
                          {i > 0 && <Separator />}
                          <div className="px-4 py-2.5 flex items-center gap-3">
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-semibold shrink-0">
                              {stepLabel(r.step_type)}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {unit?.name ?? "—"}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {cg?.name ?? "—"} · {r.users?.display_name ?? ""}
                              </p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums shrink-0">
                              {r.score != null ? `${r.score}/${r.max_score}` : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            )}

            {/* Learning Pace - per content group */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">学習ペース</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  授業実施 {totalLessons}日 · 直近4週の完了ペース
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {cgPaceList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">データなし</p>
                ) : (
                  <div className="space-y-4">
                    {cgPaceList.map((p) => {
                      const pct = p.totalCount > 0 ? Math.round((p.completedCount / p.totalCount) * 100) : 0;
                      return (
                        <div key={p.name} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{p.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {p.completedCount}/{p.totalCount}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="tabular-nums">
                              {p.weeklyPace > 0 ? `${p.weeklyPace}単元/週` : "— / 未定"}
                            </span>
                            {p.predictedLabel != null && (
                              <>
                                <span>·</span>
                                <span>
                                  残{p.remaining}単元 → {p.predictedLabel}頃
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
