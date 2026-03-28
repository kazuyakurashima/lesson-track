import type { StepType, ContentCategory } from "@/lib/types/supabase";

export interface Student {
  id: string;
  name: string;
  grade: string;
}

export interface Subject {
  id: string;
  name: string;
  display_order: number;
}

export interface ContentGroup {
  id: string;
  subject_id: string;
  name: string;
  category: ContentCategory;
  display_order: number;
}

export interface Unit {
  id: string;
  name: string;
  unit_number: number;
  content_group_id: string;
}

export interface Recommendation {
  unit: Unit;
  stepType: StepType;
  reason: string;
  contentGroupName: string;
  contentGroupId: string;
  subjectId: string;
}

export interface AiAnalyzeResult {
  subject_name: string | null;
  content_group_name: string | null;
  unit_name: string | null;
  unit_number: number | null;
  step_type: StepType | null;
  score: number | null;
  max_score: number | null;
  confidence: number;
  raw_response?: string;
}

export type Mode = "photo" | "manual";
