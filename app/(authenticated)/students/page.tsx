import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">生徒一覧</h1>
        {isAdmin && (
          <Link
            href="/students/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-primary text-white text-sm font-medium
                     hover:bg-primary-dark active:scale-[0.98] transition-all"
          >
            <Plus size={16} />
            追加
          </Link>
        )}
      </div>

      {!students || students.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted mb-3">生徒が登録されていません</p>
          {isAdmin && (
            <Link
              href="/students/new"
              className="text-primary font-medium text-sm hover:underline"
            >
              最初の生徒を登録する
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => {
            const subjects = student.student_subjects?.map(
              (ss) => ss.subjects?.name
            );

            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className={`block bg-card rounded-xl border border-border p-4
                         hover:border-primary/30 hover:shadow-sm transition-all
                         ${!student.is_active ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{student.name}</span>
                      {!student.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-border text-text-muted">
                          退塾
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
                        {student.grade}
                      </span>
                      <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
                        {enrollmentLabel(student.enrollment_type)}
                      </span>
                      {subjects?.map((name) => (
                        <span
                          key={name}
                          className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                    {student.schedule_note && (
                      <p className="text-xs text-text-muted mt-1">
                        {student.schedule_note}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-text-muted flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
