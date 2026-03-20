-- Seed: 鈴木凛乃の生徒登録と過去授業記録
-- Run AFTER schema.sql and seed_units.sql
-- Idempotent: skips if student '鈴木凛乃' already exists
-- Expected records: 63 (19 on 2/27 + 19 on 3/3 + 25 on 3/10)

DO $$
DECLARE
  v_admin_id UUID;
  v_student_id UUID;
  v_english_id UUID;
  v_math_id UUID;
  v_japanese_id UUID;
  v_cg_tango UUID;      -- 英単語 高校入試重要600
  v_cg_grammar UUID;    -- 英文法
  v_cg_kanji1 UUID;     -- 東京書籍1年 漢字
  v_cg_math1 UUID;      -- 1年のまとめ
  v_unit_id UUID;
BEGIN
  -- Skip if already seeded
  SELECT id INTO v_student_id FROM students WHERE name = '鈴木凛乃' LIMIT 1;
  IF v_student_id IS NOT NULL THEN
    RAISE NOTICE 'Student 鈴木凛乃 already exists (id=%), skipping seed.', v_student_id;
    RETURN;
  END IF;

  -- Get admin user
  SELECT id INTO v_admin_id FROM users WHERE role = 'admin' LIMIT 1;

  -- Get subject IDs
  SELECT id INTO v_english_id FROM subjects WHERE name = '英語';
  SELECT id INTO v_math_id FROM subjects WHERE name = '数学';
  SELECT id INTO v_japanese_id FROM subjects WHERE name = '国語';

  -- Get content group IDs
  SELECT id INTO v_cg_tango FROM content_groups WHERE name = '英単語 高校入試重要600';
  SELECT id INTO v_cg_grammar FROM content_groups WHERE name = '英文法';
  SELECT id INTO v_cg_kanji1 FROM content_groups WHERE name = '東京書籍1年 漢字';
  SELECT id INTO v_cg_math1 FROM content_groups WHERE name = '1年のまとめ';

  -- ============================================================
  -- 1. 生徒登録
  -- ============================================================
  INSERT INTO students (id, name, grade, enrollment_type, schedule_note, created_by)
  VALUES (
    gen_random_uuid(), '鈴木凛乃', '中2', 'ongoing',
    '火曜日2回。4月から本格開始',
    v_admin_id
  )
  RETURNING id INTO v_student_id;

  -- 受講科目
  INSERT INTO student_subjects (student_id, subject_id) VALUES
    (v_student_id, v_english_id),
    (v_student_id, v_math_id),
    (v_student_id, v_japanese_id);

  -- ============================================================
  -- 2. 授業記録: 2026-02-27
  -- ============================================================

  -- 英単語: 第1〜4回 ラーニング
  FOR i IN 1..4 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_tango AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-02-27', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 英単語: 第1〜4回 ステップ2 まとめテスト 75/78 (96.2% → passed)
  FOR i IN 1..4 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_tango AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-02-27', 'step2', 75, 78, 'manual', 'passed', '【まとめ】第1回〜第4回');
  END LOOP;

  -- 英文法: 単元1 ラーニング (【I】主語と動詞,品詞)
  SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_grammar AND unit_number = 1;
  INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
  VALUES (v_student_id, v_unit_id, v_admin_id, '2026-02-27', 'learning', NULL, NULL, NULL, NULL, NULL);

  -- 国語 中１漢字: 単元1〜3 ラーニング
  FOR i IN 1..3 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_kanji1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-02-27', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 国語 中１漢字: 単元1〜3 ステップ2 まとめテスト 54/89 (60.7% → not passed)
  FOR i IN 1..3 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_kanji1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-02-27', 'step2', 54, 89, 'manual', NULL, '【まとめ】単元1〜3');
  END LOOP;

  -- 数学 1年のまとめ: 単元1〜4 ラーニング
  FOR i IN 1..4 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_math1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-02-27', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- ============================================================
  -- 3. 授業記録: 2026-03-03
  -- ============================================================

  -- 英単語: 第5〜8回 ラーニング
  FOR i IN 5..8 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_tango AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-03', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 英単語: 第5〜8回 ステップ2 まとめテスト 74/81 (91.4% → passed)
  FOR i IN 5..8 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_tango AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-03', 'step2', 74, 81, 'manual', 'passed', '【まとめ】第5回〜第8回');
  END LOOP;

  -- 英文法: 単元2〜4 ラーニング (【I】be動詞, 一般動詞, 名詞複数形冠詞)
  FOR i IN 2..4 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_grammar AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-03', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 国語 中１漢字: 単元4〜6 ラーニング
  FOR i IN 4..6 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_kanji1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-03', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 国語 中１漢字: 単元4〜6 ステップ2 まとめテスト 38/84 (45.2% → not passed)
  FOR i IN 4..6 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_kanji1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-03', 'step2', 38, 84, 'manual', NULL, '【まとめ】単元4〜6');
  END LOOP;

  -- 数学 1年のまとめ: 単元5〜6 ラーニング
  FOR i IN 5..6 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_math1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-03', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- ============================================================
  -- 4. 授業記録: 2026-03-10
  -- ============================================================

  -- 英単語: 第9〜12回 ラーニング（テストなし）
  FOR i IN 9..12 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_tango AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-10', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 英文法: 単元5 ラーニング (【I】形容詞、副詞)
  SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_grammar AND unit_number = 5;
  INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
  VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-10', 'learning', NULL, NULL, NULL, NULL, NULL);

  -- 英文法: 単元1〜5 ステップ1 まとめテスト 29/31 (93.5%)
  FOR i IN 1..5 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_grammar AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-10', 'step1', 29, 31, 'manual', NULL, '【まとめ】単元1〜5');
  END LOOP;

  -- 国語 中１漢字: 単元7〜9 ラーニング
  FOR i IN 7..9 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_kanji1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-10', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 数学 1年のまとめ: 単元7〜9 ラーニング
  FOR i IN 7..9 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_math1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-10', 'learning', NULL, NULL, NULL, NULL, NULL);
  END LOOP;

  -- 数学 1年のまとめ: 単元1〜9 ステップ1 まとめテスト 28/34 (82.4%)
  FOR i IN 1..9 LOOP
    SELECT id INTO v_unit_id FROM units WHERE content_group_id = v_cg_math1 AND unit_number = i;
    INSERT INTO lesson_records (student_id, unit_id, instructor_id, lesson_date, step_type, score, max_score, score_source, completion_type, comment)
    VALUES (v_student_id, v_unit_id, v_admin_id, '2026-03-10', 'step1', 28, 34, 'manual', NULL, '【まとめ】単元1〜9');
  END LOOP;

  RAISE NOTICE 'Seed complete: student_id = %', v_student_id;
END $$;
