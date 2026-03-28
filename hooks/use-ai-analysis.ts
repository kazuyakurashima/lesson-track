"use client";

import { useState, useCallback, type MutableRefObject } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Subject,
  ContentGroup,
  Unit,
  AiAnalyzeResult,
  Recommendation,
} from "@/lib/types/lesson-record";
import type { StepType } from "@/lib/types/supabase";
import { fuzzyMatch } from "@/lib/fuzzy-match";

interface UseAiAnalysisParams {
  supabase: SupabaseClient;
  aiLockRef: MutableRefObject<boolean>;
  subjects: Subject[];
  allContentGroups: ContentGroup[];
  recommendations: Recommendation[];
  setSelectedSubjectId: (id: string) => void;
  setContentGroups: (cgs: ContentGroup[]) => void;
  setSelectedContentGroupId: (id: string) => void;
  setUnits: (units: Unit[]) => void;
  setSelectedUnit: (unit: Unit | null) => void;
  setSelectedStepType: (st: StepType) => void;
  setScore: (s: string) => void;
  setMaxScore: (s: string) => void;
  setCurrentStep: (step: number) => void;
}

export function useAiAnalysis({
  supabase,
  aiLockRef,
  subjects,
  allContentGroups,
  recommendations,
  setSelectedSubjectId,
  setContentGroups,
  setSelectedContentGroupId,
  setUnits,
  setSelectedUnit,
  setSelectedStepType,
  setScore,
  setMaxScore,
  setCurrentStep,
}: UseAiAnalysisParams) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiAnalyzeResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState("");

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  }

  /** Match AI result against DB records and populate selections. */
  const applyAiResult = useCallback(
    async (result: AiAnalyzeResult) => {
      // Lock to prevent useEffects from overwriting AI-set values
      aiLockRef.current = true;
      // --- Match subject ---
      const matchedSubject = fuzzyMatch(
        result.subject_name,
        subjects,
        (a, b) => a.display_order - b.display_order
      );
      if (matchedSubject) {
        setSelectedSubjectId(matchedSubject.id);
      }

      // Load content groups directly from DB for the matched subject
      const targetSubjectId = matchedSubject?.id ?? "";
      let cgsForSubject: ContentGroup[] = allContentGroups.filter(
        (cg) => cg.subject_id === targetSubjectId
      );
      if (cgsForSubject.length === 0 && targetSubjectId) {
        const { data: freshCGs } = await supabase
          .from("content_groups")
          .select("id, subject_id, name, category, display_order")
          .eq("subject_id", targetSubjectId)
          .order("display_order");
        if (freshCGs && freshCGs.length > 0) {
          cgsForSubject = freshCGs as ContentGroup[];
        }
      }

      // --- Match content group (with unit-based disambiguation) ---
      let matchedCG = fuzzyMatch(
        result.content_group_name,
        cgsForSubject,
        (a, b) => a.display_order - b.display_order,
        true // use alias mapping for content group names
      );

      // If we have a unit name, try to find which CG actually contains it.
      if (result.unit_name && cgsForSubject.length > 0) {
        const cgIds = cgsForSubject.map((cg) => cg.id);
        const { data: allCgUnits } = await supabase
          .from("units")
          .select("id, name, unit_number, content_group_id")
          .in("content_group_id", cgIds)
          .order("unit_number");

        if (allCgUnits && allCgUnits.length > 0) {
          let unitMatch = fuzzyMatch(
            result.unit_name,
            allCgUnits as Unit[],
            (a, b) => a.unit_number - b.unit_number
          );

          // Fallback: if name match failed but we have unit_number + matched CG
          if (!unitMatch && result.unit_number && matchedCG) {
            unitMatch = (allCgUnits as Unit[]).find(
              (u) => u.content_group_id === matchedCG!.id && u.unit_number === result.unit_number
            ) ?? null;
          }

          if (unitMatch) {
            const correctCG = cgsForSubject.find(
              (cg) => cg.id === unitMatch!.content_group_id
            );
            if (correctCG) {
              matchedCG = correctCG;
            }
          }
        }
      }

      if (matchedCG) {
        setContentGroups(cgsForSubject);
        setSelectedContentGroupId(matchedCG.id);

        const { data: cgUnits } = await supabase
          .from("units")
          .select("id, name, unit_number, content_group_id")
          .eq("content_group_id", matchedCG.id)
          .order("unit_number");

        if (cgUnits) {
          setUnits(cgUnits as Unit[]);
          let matchedUnit = fuzzyMatch(
            result.unit_name,
            cgUnits as Unit[],
            (a, b) => a.unit_number - b.unit_number
          );
          if (!matchedUnit && result.unit_number) {
            matchedUnit = (cgUnits as Unit[]).find(
              (u) => u.unit_number === result.unit_number
            ) ?? null;
          }
          if (matchedUnit) {
            setSelectedUnit(matchedUnit);
          }
        }
      }

      // --- Step type ---
      if (result.step_type) {
        setSelectedStepType(result.step_type);
      }

      // --- Score ---
      if (result.score !== null) {
        setScore(String(result.score));
      }
      if (result.max_score !== null) {
        setMaxScore(String(result.max_score));
      }

      // Release lock after effects have settled
      setTimeout(() => { aiLockRef.current = false; }, 500);
    },
    [subjects, allContentGroups, supabase, aiLockRef, setSelectedSubjectId, setContentGroups, setSelectedContentGroupId, setUnits, setSelectedUnit, setSelectedStepType, setScore, setMaxScore]
  );

  /** Apply recommendation values as fallback when AI returns null for all fields. */
  const applyRecommendationFallback = useCallback(() => {
    if (recommendations.length === 0) return;
    const rec = recommendations[0];
    setSelectedSubjectId(rec.subjectId);
    setSelectedContentGroupId(rec.contentGroupId);
    setSelectedUnit(rec.unit);
    setSelectedStepType(rec.stepType);
  }, [recommendations, setSelectedSubjectId, setSelectedContentGroupId, setSelectedUnit, setSelectedStepType]);

  async function analyzeImage() {
    if (!imageFile) return;
    setAnalyzing(true);
    setAiError(false);
    setAiErrorMsg("");
    setAiResult(null);

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("Analyze API error:", res.status, errBody);
        throw new Error(errBody.debug || errBody.error || "API error");
      }

      const data: AiAnalyzeResult = await res.json();
      setAiResult(data);

      // Check if AI returned anything useful
      const hasAnyField =
        data.subject_name ||
        data.content_group_name ||
        data.unit_name ||
        data.step_type ||
        data.score !== null;

      if (hasAnyField) {
        await applyAiResult(data);
      } else {
        // All null -- use recommendations as fallback
        applyRecommendationFallback();
      }

      // Move to confirmation step
      setCurrentStep(2);
    } catch (err) {
      setAiError(true);
      setAiErrorMsg(err instanceof Error ? err.message : "Unknown error");
      applyRecommendationFallback();
      setCurrentStep(2);
    } finally {
      setAnalyzing(false);
    }
  }

  return {
    imageFile,
    setImageFile,
    imagePreview,
    setImagePreview,
    aiResult,
    setAiResult,
    analyzing,
    aiError,
    setAiError,
    aiErrorMsg,
    handleImageChange,
    analyzeImage,
  };
}
