"use client";

import Link from "next/link";
import { enrollmentLabel } from "@/lib/constants";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StudentData {
  id: string;
  name: string;
  grade: string;
  enrollmentType: string;
  scheduleNote: string | null;
  isActive: boolean;
  subjects: string[];
}

export function StudentListClient({
  students,
}: {
  students: StudentData[];
}) {
  return (
    <div className="space-y-2">
      {students.map((student) => (
        <Link key={student.id} href={`/students/${student.id}`}>
          <Card
            className={`hover:shadow-md hover:border-border transition-all duration-200 ${
              !student.isActive ? "opacity-50" : ""
            }`}
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
        </Link>
      ))}
    </div>
  );
}
