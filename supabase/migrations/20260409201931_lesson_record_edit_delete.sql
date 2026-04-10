DROP POLICY IF EXISTS "Instructors can update own records" ON lesson_records;

CREATE POLICY "Instructors or admins can update records"
  ON lesson_records FOR UPDATE
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Instructors or admins can delete records"
  ON lesson_records FOR DELETE
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can delete answer sheets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'answer-sheets');
