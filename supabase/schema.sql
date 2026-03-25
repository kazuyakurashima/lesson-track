-- Lesson Track Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- ============================================================
-- Custom types
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'instructor');
CREATE TYPE content_category AS ENUM ('vocabulary', 'academic');
CREATE TYPE enrollment_type AS ENUM ('spring_course', 'ongoing', 'trial');
CREATE TYPE step_type AS ENUM ('learning', 'step1', 'step2');
CREATE TYPE score_source AS ENUM ('manual', 'ai_extracted', 'ai_corrected');
CREATE TYPE completion_type AS ENUM ('passed', 'step1_perfect');

-- ============================================================
-- Users (profile linked to Supabase Auth)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'instructor',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ============================================================
-- Students
-- ============================================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  enrollment_type enrollment_type NOT NULL,
  schedule_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id)
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read students"
  ON students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Subjects (master data)
-- ============================================================
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Content Groups (教材グループ)
-- ============================================================
CREATE TABLE content_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  category content_category NOT NULL,
  grade TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, display_order)
);

ALTER TABLE content_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read content_groups"
  ON content_groups FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Units (master data)
-- ============================================================
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_group_id UUID NOT NULL REFERENCES content_groups(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  unit_number INT NOT NULL,
  UNIQUE(content_group_id, unit_number)
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read units"
  ON units FOR SELECT
  TO authenticated
  USING (true);

-- Index for ordered queries
CREATE INDEX idx_units_content_group_order ON units(content_group_id, unit_number);

-- ============================================================
-- Student Subjects (many-to-many)
-- ============================================================
CREATE TABLE student_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  UNIQUE(student_id, subject_id)
);

ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read student_subjects"
  ON student_subjects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage student_subjects"
  ON student_subjects FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Student Content Groups (optional per-student content selection)
-- ============================================================
CREATE TABLE student_content_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content_group_id UUID NOT NULL REFERENCES content_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, content_group_id)
);

ALTER TABLE student_content_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage student_content_groups"
  ON student_content_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_student_content_groups_student ON student_content_groups(student_id);
CREATE INDEX idx_student_content_groups_content_group ON student_content_groups(content_group_id);

-- ============================================================
-- Lesson Records
-- ============================================================
CREATE TABLE lesson_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES users(id),
  lesson_date DATE NOT NULL DEFAULT CURRENT_DATE,
  step_type step_type NOT NULL,
  score INT,
  max_score INT,
  score_source score_source,
  completion_type completion_type,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lesson_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lesson_records"
  ON lesson_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lesson_records"
  ON lesson_records FOR INSERT
  TO authenticated
  WITH CHECK (instructor_id = auth.uid());

CREATE POLICY "Instructors can update own records"
  ON lesson_records FOR UPDATE
  TO authenticated
  USING (instructor_id = auth.uid());

-- Indexes for common queries
CREATE INDEX idx_lesson_records_student_date ON lesson_records(student_id, lesson_date DESC);
CREATE INDEX idx_lesson_records_student_unit ON lesson_records(student_id, unit_id);
CREATE INDEX idx_lesson_records_unit_step ON lesson_records(unit_id, step_type);

-- ============================================================
-- Record Images
-- ============================================================
CREATE TABLE record_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES lesson_records(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  ai_extracted_score INT,
  ai_confidence FLOAT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE record_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read record_images"
  ON record_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert record_images"
  ON record_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- Learning Goals
-- ============================================================
CREATE TABLE learning_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  target_date DATE NOT NULL,
  actual_completed_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE learning_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read learning_goals"
  ON learning_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage learning_goals"
  ON learning_goals FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Storage bucket for answer sheet images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('answer-sheets', 'answer-sheets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload answer sheets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'answer-sheets');

CREATE POLICY "Authenticated users can read answer sheets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'answer-sheets');

-- ============================================================
-- Seed: Subject master data
-- ============================================================
-- Use DO block to insert subjects idempotently and store IDs for content_groups
DO $$
DECLARE
  v_english_id UUID;
  v_math_id UUID;
  v_japanese_id UUID;
BEGIN
  -- Subjects (idempotent)
  INSERT INTO subjects (name, display_order) VALUES ('英語', 1) ON CONFLICT DO NOTHING;
  INSERT INTO subjects (name, display_order) VALUES ('数学', 2) ON CONFLICT DO NOTHING;
  INSERT INTO subjects (name, display_order) VALUES ('国語', 3) ON CONFLICT DO NOTHING;
  INSERT INTO subjects (name, display_order) VALUES ('理科', 4) ON CONFLICT DO NOTHING;
  INSERT INTO subjects (name, display_order) VALUES ('社会', 5) ON CONFLICT DO NOTHING;
  INSERT INTO subjects (name, display_order) VALUES ('算数', 6) ON CONFLICT DO NOTHING;

  SELECT id INTO v_english_id FROM subjects WHERE name = '英語';
  SELECT id INTO v_math_id FROM subjects WHERE name = '数学';
  SELECT id INTO v_japanese_id FROM subjects WHERE name = '国語';

  -- Content groups (idempotent via unique constraint on subject_id, display_order)
  INSERT INTO content_groups (subject_id, name, category, grade, display_order) VALUES
    (v_english_id,  '英文法',               'academic',   NULL, 1),
    (v_english_id,  '英熟語 高校入試重要300', 'vocabulary', NULL, 2),
    (v_english_id,  '英単語 高校入試重要600', 'vocabulary', NULL, 3),
    (v_english_id,  '英文法 入門',           'academic',   NULL, 4),
    (v_math_id,     '1年のまとめ',           'academic',   '中1', 1),
    (v_math_id,     '2年のまとめ',           'academic',   '中2', 2),
    (v_math_id,     '1年[共通版]',           'academic',   '中1', 3),
    (v_math_id,     '2年[共通版]',           'academic',   '中2', 4),
    (v_japanese_id, '東京書籍1年 漢字',      'vocabulary', '中1', 1),
    (v_japanese_id, '東京書籍2年 漢字',      'vocabulary', '中2', 2)
  ON CONFLICT (subject_id, display_order) DO NOTHING;
END $$;

-- ============================================================
-- Function: auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'instructor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
