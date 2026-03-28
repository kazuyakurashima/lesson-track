"use client";

import { useState } from "react";
import Link from "next/link";
import { enrollmentLabel, stepLabel } from "@/lib/constants";
import { ChevronRight, ArrowRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

interface StudentData {
  id: string;
  name: string;
  grade: string;
  enrollmentType: string;
  scheduleNote: string | null;
  isActive: boolean;
  subjects: string[];
}

interface RecordData {
  id: string;
  studentId: string;
  lessonDate: string;
  stepType: string;
  score: number | null;
  maxScore: number | null;
  unitName: string;
  contentGroupName: string;
  instructor: string;
}

export function StudentListClient({
  students,
  recentRecords,
}: {
  students: StudentData[];
  recentRecords: RecordData[];
}) {
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleStudentClick(student: StudentData) {
    setSelectedStudent(student);
    setDrawerOpen(true);
  }

  const studentRecords = selectedStudent
    ? recentRecords.filter((r) => r.studentId === selectedStudent.id).slice(0, 8)
    : [];

  return (
    <>
      <div className="space-y-2">
        {students.map((student) => (
          <Card
            key={student.id}
            className={`cursor-pointer hover:shadow-md hover:border-border transition-all duration-200 ${
              !student.isActive ? "opacity-50" : ""
            }`}
            onClick={() => handleStudentClick(student)}
          >
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{student.name}</span>
                    {!student.isActive && (
                      <Badge variant="secondary" className="text-[10px]">退塾</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                      {student.grade}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                      {enrollmentLabel(student.enrollmentType)}
                    </Badge>
                    {student.subjects.map((name) => (
                      <Badge key={name} variant="outline" className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick-view Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col">
          {selectedStudent && (
            <>
              <SheetHeader className="px-5 py-4 border-b border-border/50 shrink-0">
                <SheetTitle className="text-left">
                  <span className="text-base font-bold">{selectedStudent.name}</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                      {selectedStudent.grade}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                      {enrollmentLabel(selectedStudent.enrollmentType)}
                    </Badge>
                  </div>
                  {selectedStudent.scheduleNote && (
                    <p className="text-xs text-muted-foreground mt-1 font-normal">
                      {selectedStudent.scheduleNote}
                    </p>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {/* Subjects */}
                <div className="px-5 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    受講科目
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {selectedStudent.subjects.length > 0
                      ? selectedStudent.subjects.map((name) => (
                          <Badge key={name} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))
                      : <span className="text-xs text-muted-foreground">未設定</span>
                    }
                  </div>
                </div>

                <Separator />

                {/* Recent Records */}
                <div className="px-5 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    最近の記録
                  </p>
                  {studentRecords.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">記録なし</p>
                  ) : (
                    <div className="space-y-0">
                      {studentRecords.map((record, i) => {
                        const isBelowThreshold =
                          record.score !== null &&
                          record.maxScore !== null &&
                          record.maxScore > 0 &&
                          record.score / record.maxScore < 0.8;

                        return (
                          <div key={record.id}>
                            {i > 0 && <Separator className="my-0" />}
                            <div className="py-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {record.lessonDate}
                                </span>
                                <div className="flex items-center gap-1">
                                  {record.score !== null && (
                                    <span className={`text-xs font-bold tabular-nums ${isBelowThreshold ? "text-amber-600" : ""}`}>
                                      {record.score}/{record.maxScore}
                                    </span>
                                  )}
                                  {isBelowThreshold && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[11px] text-muted-foreground/60 truncate">
                                  {record.contentGroupName}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {record.unitName}
                                </span>
                                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-semibold shrink-0">
                                  {stepLabel(record.stepType)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer — link to full detail page */}
              <div className="px-5 py-3 border-t border-border/50 shrink-0">
                <Link
                  href={`/students/${selectedStudent.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                           bg-primary text-primary-foreground text-sm font-medium
                           hover:bg-primary/90 active:translate-y-px transition-all"
                  onClick={() => setDrawerOpen(false)}
                >
                  詳細を見る
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
