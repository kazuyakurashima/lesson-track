"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { stepLabel } from "@/lib/constants";
import type { StepType, UserRole } from "@/lib/types/supabase";

interface RecordActionsProps {
  record: {
    id: string;
    lesson_date: string;
    step_type: StepType;
    score: number | null;
    max_score: number | null;
    comment: string | null;
    unit_id: string;
    instructor_id: string;
  };
  visibleUnits: Array<{
    id: string;
    name: string;
    content_group_id: string;
    content_group_name: string;
  }>;
  currentUserId: string;
  currentUserRole: UserRole;
}

type FormState = {
  lessonDate: string;
  stepType: StepType;
  unitId: string;
  score: string;
  maxScore: string;
  comment: string;
};

function buildInitialFormState(record: RecordActionsProps["record"]): FormState {
  return {
    lessonDate: record.lesson_date,
    stepType: record.step_type,
    unitId: record.unit_id,
    score: record.score?.toString() ?? "",
    maxScore: record.max_score?.toString() ?? "",
    comment: record.comment ?? "",
  };
}

export default function RecordActions({
  record,
  visibleUnits,
  currentUserId,
  currentUserRole,
}: RecordActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => buildInitialFormState(record));

  const canManage = record.instructor_id === currentUserId || currentUserRole === "admin";
  const initialForm = buildInitialFormState(record);
  const groupedUnitMap = new Map<string, {
    contentGroupId: string;
    contentGroupName: string;
    units: typeof visibleUnits;
  }>();
  for (const unit of visibleUnits) {
    const existingGroup = groupedUnitMap.get(unit.content_group_id);
    if (existingGroup) {
      existingGroup.units.push(unit);
      continue;
    }

    groupedUnitMap.set(unit.content_group_id, {
      contentGroupId: unit.content_group_id,
      contentGroupName: unit.content_group_name,
      units: [unit],
    });
  }
  const groupedUnits = Array.from(groupedUnitMap.values());

  useEffect(() => {
    if (editOpen) {
      setForm(buildInitialFormState(record));
      setError(null);
    }
  }, [editOpen, record]);

  if (!canManage) return null;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload():
    | { ok: false; error: string }
    | { ok: true; payload: Record<string, string | number | null> } {
    const trimmedScore = form.score.trim();
    const trimmedMaxScore = form.maxScore.trim();
    const nextScore = trimmedScore === "" ? null : Number.parseInt(trimmedScore, 10);
    const nextMaxScore = trimmedMaxScore === "" ? null : Number.parseInt(trimmedMaxScore, 10);
    const nextComment = form.comment.trim();

    if (trimmedScore !== "" && Number.isNaN(nextScore)) {
      return { ok: false, error: "点数は整数で入力してください" };
    }

    if (trimmedMaxScore !== "" && Number.isNaN(nextMaxScore)) {
      return { ok: false, error: "満点は整数で入力してください" };
    }

    if (nextMaxScore !== null && nextMaxScore <= 0) {
      return { ok: false, error: "満点は 1 以上で入力してください" };
    }

    if (nextScore !== null && nextScore < 0) {
      return { ok: false, error: "点数は 0 以上で入力してください" };
    }

    if (nextScore !== null && nextMaxScore === null) {
      return { ok: false, error: "点数を入力する場合は満点も入力してください" };
    }

    if (nextScore !== null && nextMaxScore !== null && nextScore > nextMaxScore) {
      return { ok: false, error: "点数は満点を超えられません" };
    }

    const payload: Record<string, string | number | null> = {};
    if (form.lessonDate !== initialForm.lessonDate) payload.lesson_date = form.lessonDate;
    if (form.stepType !== initialForm.stepType) payload.step_type = form.stepType;
    if (form.unitId !== initialForm.unitId) payload.unit_id = form.unitId;
    if (nextScore !== record.score) payload.score = nextScore;
    if (nextMaxScore !== record.max_score) payload.max_score = nextMaxScore;
    if (nextComment !== (record.comment ?? "")) payload.comment = nextComment || null;

    return { ok: true, payload };
  }

  async function handleSave() {
    const result = buildPayload();
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (Object.keys(result.payload).length === 0) {
      setEditOpen(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/lesson-records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "記録の更新に失敗しました");
      }

      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "記録の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/lesson-records/${record.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "記録の削除に失敗しました");
      }

      setDeleteOpen(false);
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "記録の削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="授業記録の操作"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            編集
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>授業記録を編集</SheetTitle>
            <SheetDescription>
              日付、単元、ステップ、点数、コメントを更新できます。
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">授業日</label>
              <Input
                type="date"
                value={form.lessonDate}
                onChange={(event) => updateForm("lessonDate", event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">ステップ種別</label>
              <div className="grid grid-cols-3 gap-2">
                {(["learning", "step1", "step2"] as const).map((stepType) => (
                  <Button
                    key={stepType}
                    type="button"
                    variant={form.stepType === stepType ? "default" : "outline"}
                    onClick={() => updateForm("stepType", stepType)}
                  >
                    {stepLabel(stepType)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">単元</label>
              <select
                value={form.unitId}
                onChange={(event) => updateForm("unitId", event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {groupedUnits.map((group) => (
                  <optgroup
                    key={group.contentGroupId}
                    label={group.contentGroupName}
                  >
                    {group.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">点数</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.score}
                  onChange={(event) => updateForm("score", event.target.value)}
                  placeholder="—"
                />
              </div>
              <span className="pb-2 text-sm text-muted-foreground">/</span>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">満点</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.maxScore}
                  onChange={(event) => updateForm("maxScore", event.target.value)}
                  placeholder="100"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">コメント</label>
              <textarea
                value={form.comment}
                onChange={(event) => updateForm("comment", event.target.value)}
                rows={4}
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="気になった点などをメモ"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <SheetFooter className="border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この記録を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              関連する答案画像も削除されます。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
