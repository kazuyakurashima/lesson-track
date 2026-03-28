"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Student,
  Subject,
  ContentGroup,
  Unit,
  Recommendation,
} from "@/lib/types/lesson-record";

export function useRecommendations(
  selectedStudent: Student | null,
  subjects: Subject[],
  supabase: SupabaseClient,
) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const loadRecommendations = useCallback(async () => {
    if (!selectedStudent || subjects.length === 0) return;

    const subjectIds = subjects.map((s) => s.id);
    const { data: cgs } = await supabase
      .from("content_groups")
      .select("id, subject_id, name, category, display_order")
      .in("subject_id", subjectIds)
      .order("display_order");

    if (!cgs) return;

    const { data: records } = (await supabase
      .from("lesson_records")
      .select("unit_id, step_type, score, max_score, completion_type")
      .eq("student_id", selectedStudent.id)) as {
      data: Array<{
        unit_id: string;
        step_type: string;
        score: number | null;
        max_score: number | null;
        completion_type: string | null;
      }> | null;
    };

    if (!records) return;

    // Batch-load ALL units for the student's content groups (avoids N+1)
    const cgIds = (cgs as ContentGroup[]).map((cg) => cg.id);
    const { data: allCgUnits } = (await supabase
      .from("units")
      .select("id, name, unit_number, content_group_id")
      .in("content_group_id", cgIds)
      .order("unit_number")) as { data: Unit[] | null };

    if (!allCgUnits) return;

    const recs: Recommendation[] = [];

    for (const cg of cgs as ContentGroup[]) {
      const cgUnits = allCgUnits.filter((u) => u.content_group_id === cg.id);

      for (const unit of cgUnits) {
        const unitRecords = records.filter((r) => r.unit_id === unit.id);
        const hasLearning = unitRecords.some(
          (r) => r.step_type === "learning"
        );
        const hasStep1 = unitRecords.some((r) => r.step_type === "step1");
        const step2Records = unitRecords.filter(
          (r) => r.step_type === "step2"
        );
        const hasPassedStep2 = unitRecords.some(
          (r) =>
            r.completion_type === "passed" ||
            r.completion_type === "step1_perfect"
        );

        if (hasPassedStep2) continue;

        // Retest needed
        if (step2Records.length > 0) {
          const latest = step2Records[step2Records.length - 1];
          if (!latest.completion_type) {
            recs.push({
              unit,
              stepType: "step2",
              reason: `前回 ${latest.score}/${latest.max_score} → 再テスト`,
              contentGroupName: cg.name,
              contentGroupId: cg.id,
              subjectId: cg.subject_id,
            });
            break;
          }
        }

        // Vocabulary: learning done, step2 not done
        if (
          cg.category === "vocabulary" &&
          hasLearning &&
          step2Records.length === 0
        ) {
          recs.push({
            unit,
            stepType: "step2",
            reason: "ラーニング済み → ステップ2テスト",
            contentGroupName: cg.name,
            contentGroupId: cg.id,
            subjectId: cg.subject_id,
          });
          break;
        }

        // Academic: step1 done, step2 not done
        if (
          cg.category === "academic" &&
          hasStep1 &&
          step2Records.length === 0
        ) {
          recs.push({
            unit,
            stepType: "step2",
            reason: "ステップ1済み → ステップ2",
            contentGroupName: cg.name,
            contentGroupId: cg.id,
            subjectId: cg.subject_id,
          });
          break;
        }

        // Not started yet
        if (unitRecords.length === 0) {
          recs.push({
            unit,
            stepType: "learning",
            reason: "次の単元",
            contentGroupName: cg.name,
            contentGroupId: cg.id,
            subjectId: cg.subject_id,
          });
          break;
        }
      }
    }

    setRecommendations(recs);
  }, [selectedStudent, subjects, supabase]);

  useEffect(() => {
    loadRecommendations(); // eslint-disable-line react-hooks/set-state-in-effect -- trigger async data fetch
  }, [loadRecommendations]);

  return {
    recommendations,
    loadRecommendations,
  };
}
