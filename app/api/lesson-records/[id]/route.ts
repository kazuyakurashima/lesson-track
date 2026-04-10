import { NextResponse } from "next/server";
import { calcCompletionType, calcScoreSource } from "@/lib/lesson-record-utils";
import { createClient } from "@/lib/supabase/server";
import type { StepType, UserRole } from "@/lib/types/supabase";

type PatchPayload = {
  lesson_date?: string;
  step_type?: StepType;
  unit_id?: string;
  score?: number | null;
  max_score?: number | null;
  comment?: string | null;
};

const PATCH_FIELDS = new Set([
  "lesson_date",
  "step_type",
  "unit_id",
  "score",
  "max_score",
  "comment",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isStepType(value: unknown): value is StepType {
  return value === "learning" || value === "step1" || value === "step2";
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value));
}

async function getCurrentUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, response: jsonError("Unauthorized", 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single() as {
    data: { role: UserRole } | null;
    error: { message: string } | null;
  };

  if (profileError || !profile) {
    return { supabase, response: jsonError("User profile not found", 403) };
  }

  return { supabase, user, role: profile.role };
}

async function getLessonRecord(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  return (await supabase
    .from("lesson_records")
    .select("id, instructor_id, lesson_date, step_type, unit_id, score, max_score, comment")
    .eq("id", id)
    .maybeSingle()) as {
    data: {
      id: string;
      instructor_id: string;
      lesson_date: string;
      step_type: StepType;
      unit_id: string;
      score: number | null;
      max_score: number | null;
      comment: string | null;
    } | null;
    error: { message: string } | null;
  };
}

function canManageRecord(recordInstructorId: string, userId: string, role: UserRole) {
  return recordInstructorId === userId || role === "admin";
}

function validatePatchPayload(payload: Record<string, unknown>): PatchPayload | string {
  const keys = Object.keys(payload);
  if (keys.length === 0) return "更新項目がありません";

  for (const key of keys) {
    if (!PATCH_FIELDS.has(key)) return `更新できない項目が含まれています: ${key}`;
  }

  if ("lesson_date" in payload) {
    if (typeof payload.lesson_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.lesson_date)) {
      return "lesson_date は YYYY-MM-DD 形式で指定してください";
    }
  }

  if ("step_type" in payload && !isStepType(payload.step_type)) {
    return "step_type が不正です";
  }

  if ("unit_id" in payload && (typeof payload.unit_id !== "string" || payload.unit_id.trim() === "")) {
    return "unit_id が不正です";
  }

  if ("score" in payload && !isNullableInteger(payload.score)) {
    return "score は整数または null で指定してください";
  }

  if ("max_score" in payload && !isNullableInteger(payload.max_score)) {
    return "max_score は整数または null で指定してください";
  }

  if ("comment" in payload && payload.comment !== null && typeof payload.comment !== "string") {
    return "comment は文字列または null で指定してください";
  }

  return payload as PatchPayload;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getCurrentUserContext();
  if (auth.response) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError("JSON body が必要です", 400);
  }

  if (rawBody == null || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return jsonError("不正なリクエストです", 400);
  }

  const payload = validatePatchPayload(rawBody as Record<string, unknown>);
  if (typeof payload === "string") {
    return jsonError(payload, 400);
  }

  const { data: currentRecord, error: recordError } = await getLessonRecord(auth.supabase, id);
  if (recordError) return jsonError("記録の取得に失敗しました", 500);
  if (!currentRecord) return jsonError("記録が見つかりません", 404);

  if (!canManageRecord(currentRecord.instructor_id, auth.user.id, auth.role)) {
    return jsonError("この記録を編集する権限がありません", 403);
  }

  const nextRecord = {
    lesson_date: payload.lesson_date ?? currentRecord.lesson_date,
    step_type: payload.step_type ?? currentRecord.step_type,
    unit_id: payload.unit_id ?? currentRecord.unit_id,
    score: Object.prototype.hasOwnProperty.call(payload, "score") ? payload.score! : currentRecord.score,
    max_score: Object.prototype.hasOwnProperty.call(payload, "max_score")
      ? payload.max_score!
      : currentRecord.max_score,
    comment: Object.prototype.hasOwnProperty.call(payload, "comment")
      ? payload.comment?.trim() || null
      : currentRecord.comment,
  };

  if (nextRecord.max_score !== null && nextRecord.max_score <= 0) {
    return jsonError("max_score は 1 以上で指定してください", 400);
  }

  if (nextRecord.score !== null && nextRecord.score < 0) {
    return jsonError("score は 0 以上で指定してください", 400);
  }

  if (nextRecord.score !== null && nextRecord.max_score === null) {
    return jsonError("score を指定する場合は max_score も指定してください", 400);
  }

  if (
    nextRecord.score !== null &&
    nextRecord.max_score !== null &&
    nextRecord.score > nextRecord.max_score
  ) {
    return jsonError("score は max_score を超えられません", 400);
  }

  const { data: latestImage, error: imageError } = (await auth.supabase
    .from("record_images")
    .select("ai_extracted_score")
    .eq("record_id", id)
    .order("uploaded_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: { ai_extracted_score: number | null } | null;
    error: { message: string } | null;
  };

  if (imageError) return jsonError("画像情報の取得に失敗しました", 500);

  const completion_type = calcCompletionType(
    nextRecord.step_type,
    nextRecord.score,
    nextRecord.max_score
  );
  const score_source = calcScoreSource(
    nextRecord.score,
    latestImage?.ai_extracted_score
  );

  const { data: updatedRecord, error: updateError } = (await auth.supabase
    .from("lesson_records")
    .update({
      lesson_date: nextRecord.lesson_date,
      step_type: nextRecord.step_type,
      unit_id: nextRecord.unit_id,
      score: nextRecord.score,
      max_score: nextRecord.max_score,
      comment: nextRecord.comment,
      completion_type,
      score_source,
    })
    .eq("id", id)
    .select("id, lesson_date, step_type, unit_id, score, max_score, comment, completion_type, score_source")
    .single()) as {
    data: {
      id: string;
      lesson_date: string;
      step_type: StepType;
      unit_id: string;
      score: number | null;
      max_score: number | null;
      comment: string | null;
      completion_type: string | null;
      score_source: string | null;
    } | null;
    error: { message: string } | null;
  };

  if (updateError || !updatedRecord) {
    return jsonError("記録の更新に失敗しました", 500);
  }

  return NextResponse.json({ record: updatedRecord });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getCurrentUserContext();
  if (auth.response) return auth.response;

  const { data: record, error: recordError } = await getLessonRecord(auth.supabase, id);
  if (recordError) return jsonError("記録の取得に失敗しました", 500);
  if (!record) return jsonError("記録が見つかりません", 404);

  if (!canManageRecord(record.instructor_id, auth.user.id, auth.role)) {
    return jsonError("この記録を削除する権限がありません", 403);
  }

  const { data: images, error: imageError } = (await auth.supabase
    .from("record_images")
    .select("storage_path")
    .eq("record_id", id)) as {
    data: Array<{ storage_path: string }> | null;
    error: { message: string } | null;
  };

  if (imageError) return jsonError("画像情報の取得に失敗しました", 500);

  const storagePaths = (images ?? []).map((image) => image.storage_path).filter(Boolean);
  if (storagePaths.length > 0) {
    const { error: storageError } = await auth.supabase.storage
      .from("answer-sheets")
      .remove(storagePaths);
    if (storageError) {
      console.error("Failed to delete answer sheet files:", {
        recordId: id,
        storagePaths,
        message: storageError.message,
      });
    }
  }

  const { error: deleteError } = await auth.supabase
    .from("lesson_records")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return jsonError("記録の削除に失敗しました", 500);
  }

  return NextResponse.json({ success: true });
}
