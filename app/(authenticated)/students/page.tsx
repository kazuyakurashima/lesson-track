import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StudentListClient } from "./student-list-client";

export default async function StudentsPage() {
  const supabase = await createClient();

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();

  const isAdmin = currentUser?.role === "admin";

  const { data: students } = (await supabase
    .from("students")
    .select(
      `id, name, grade, enrollment_type, schedule_note, is_active,
       student_subjects(subject_id, subjects(name))`
    )
    .order("is_active", { ascending: false })
    .order("name")) as {
    data: Array<{
      id: string;
      name: string;
      grade: string;
      enrollment_type: string;
      schedule_note: string | null;
      is_active: boolean;
      student_subjects: Array<{ subject_id: string; subjects: { name: string } }>;
    }> | null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold tracking-tight">生徒一覧</h1>
        {isAdmin && (
          <Link
            href="/students/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                     bg-primary text-primary-foreground text-sm font-medium
                     hover:bg-primary/90 active:translate-y-px transition-all"
          >
            <Plus className="h-4 w-4" />
            追加
          </Link>
        )}
      </div>

      {!students || students.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">生徒が登録されていません</p>
            {isAdmin && (
              <Link href="/students/new" className="text-sm text-primary font-medium hover:underline">
                最初の生徒を登録する
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <StudentListClient
          students={(students ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            grade: s.grade,
            enrollmentType: s.enrollment_type,
            scheduleNote: s.schedule_note,
            isActive: s.is_active,
            subjects: s.student_subjects?.map((ss) => ss.subjects?.name).filter(Boolean) ?? [],
          }))}
        />
      )}
    </div>
  );
}
