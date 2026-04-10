// Database types — generated from schema definition
// In production, use `supabase gen types typescript` to auto-generate

export type UserRole = "admin" | "instructor";
export type ContentCategory = "vocabulary" | "academic";
export type EnrollmentType = "spring_course" | "ongoing" | "trial";
export type StepType = "learning" | "step1" | "step2";
export type ScoreSource = "manual" | "ai_extracted" | "ai_corrected";
export type CompletionType = "passed" | "step1_perfect";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          display_name: string;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          role?: UserRole;
          avatar_url?: string | null;
        };
        Update: {
          display_name?: string;
          role?: UserRole;
          avatar_url?: string | null;
        };
      };
      students: {
        Row: {
          id: string;
          name: string;
          grade: string;
          enrollment_type: EnrollmentType;
          schedule_note: string | null;
          is_active: boolean;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          name: string;
          grade: string;
          enrollment_type: EnrollmentType;
          schedule_note?: string | null;
          is_active?: boolean;
          created_by: string;
        };
        Update: {
          name?: string;
          grade?: string;
          enrollment_type?: EnrollmentType;
          schedule_note?: string | null;
          is_active?: boolean;
        };
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          display_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          display_order: number;
        };
        Update: {
          name?: string;
          display_order?: number;
        };
      };
      content_groups: {
        Row: {
          id: string;
          subject_id: string;
          name: string;
          category: ContentCategory;
          grade: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          name: string;
          category: ContentCategory;
          grade?: string | null;
          display_order: number;
        };
        Update: {
          name?: string;
          category?: ContentCategory;
          grade?: string | null;
          display_order?: number;
        };
      };
      units: {
        Row: {
          id: string;
          content_group_id: string;
          name: string;
          unit_number: number;
        };
        Insert: {
          id?: string;
          content_group_id: string;
          name: string;
          unit_number: number;
        };
        Update: {
          name?: string;
          unit_number?: number;
        };
      };
      student_subjects: {
        Row: {
          id: string;
          student_id: string;
          subject_id: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject_id: string;
        };
        Update: {
          student_id?: string;
          subject_id?: string;
        };
      };
      student_content_groups: {
        Row: {
          id: string;
          student_id: string;
          content_group_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          content_group_id: string;
        };
        Update: {
          student_id?: string;
          content_group_id?: string;
        };
      };
      lesson_records: {
        Row: {
          id: string;
          student_id: string;
          unit_id: string;
          instructor_id: string;
          lesson_date: string;
          step_type: StepType;
          score: number | null;
          max_score: number | null;
          score_source: ScoreSource | null;
          completion_type: CompletionType | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          unit_id: string;
          instructor_id: string;
          lesson_date: string;
          step_type: StepType;
          score?: number | null;
          max_score?: number | null;
          score_source?: ScoreSource | null;
          completion_type?: CompletionType | null;
          comment?: string | null;
        };
        Update: {
          lesson_date?: string;
          step_type?: StepType;
          unit_id?: string;
          score?: number | null;
          max_score?: number | null;
          score_source?: ScoreSource | null;
          completion_type?: CompletionType | null;
          comment?: string | null;
        };
      };
      record_images: {
        Row: {
          id: string;
          record_id: string;
          storage_path: string;
          ai_extracted_score: number | null;
          ai_confidence: number | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          record_id: string;
          storage_path: string;
          ai_extracted_score?: number | null;
          ai_confidence?: number | null;
        };
        Update: {
          ai_extracted_score?: number | null;
          ai_confidence?: number | null;
        };
      };
      learning_goals: {
        Row: {
          id: string;
          student_id: string;
          unit_id: string;
          target_date: string;
          actual_completed_date: string | null;
          status: "pending" | "in_progress" | "completed" | "overdue";
          note: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          unit_id: string;
          target_date: string;
          actual_completed_date?: string | null;
          status?: "pending" | "in_progress" | "completed" | "overdue";
          note?: string | null;
          created_by: string;
        };
        Update: {
          target_date?: string;
          actual_completed_date?: string | null;
          status?: "pending" | "in_progress" | "completed" | "overdue";
          note?: string | null;
        };
      };
    };
  };
}
