"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Student,
  Subject,
  ContentGroup,
  Unit,
} from "@/lib/types/lesson-record";

export function useStudentData(
  selectedStudent: Student | null,
  selectedSubjectId: string,
  selectedContentGroupId: string,
  setContentGroups: (cgs: ContentGroup[]) => void,
  setSelectedContentGroupId: (id: string) => void,
  setUnits: (units: Unit[]) => void,
) {
  const supabase = useMemo(() => createClient(), []);
  const aiLockRef = useRef(false);

  // ---- Students -----------------------------------------------------------
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    supabase
      .from("students")
      .select("id, name, grade")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setStudents(data as Student[]);
      });
  }, [supabase]);

  // ---- Subjects -----------------------------------------------------------
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!selectedStudent) return;

    supabase
      .from("student_subjects")
      .select("subject_id, subjects(id, name, display_order)")
      .eq("student_id", selectedStudent.id)
      .then(({ data }) => {
        if (data) {
          const rows = data as unknown as Array<{ subjects: Subject }>;
          const subs = rows
            .map((d) => d.subjects)
            .sort((a, b) => a.display_order - b.display_order);
          setSubjects(subs);
        }
      });
  }, [selectedStudent, supabase]);

  // ---- All content groups (filtered by student_content_groups) ------------
  const [allContentGroups, setAllContentGroups] = useState<ContentGroup[]>([]);

  useEffect(() => {
    if (subjects.length === 0 || !selectedStudent) {
      setAllContentGroups([]); // eslint-disable-line react-hooks/set-state-in-effect -- data fetch resets state
      return;
    }
    const subjectIds = subjects.map((s) => s.id);
    Promise.all([
      supabase
        .from("content_groups")
        .select("id, subject_id, name, category, display_order")
        .in("subject_id", subjectIds)
        .order("display_order"),
      supabase
        .from("student_content_groups")
        .select("content_group_id")
        .eq("student_id", selectedStudent.id),
    ]).then(([cgRes, scgRes]) => {
      const allCGs = (cgRes.data ?? []) as ContentGroup[];
      const selectedIds = new Set((scgRes.data ?? []).map((s: { content_group_id: string }) => s.content_group_id));
      // Per-subject fallback
      if (selectedIds.size === 0) {
        setAllContentGroups(allCGs);
      } else {
        const filtered = allCGs.filter((cg) => {
          const subjectHasSelections = allCGs.some(
            (other) => other.subject_id === cg.subject_id && selectedIds.has(other.id)
          );
          return subjectHasSelections ? selectedIds.has(cg.id) : true;
        });
        setAllContentGroups(filtered);
      }
    });
  }, [subjects, selectedStudent, supabase]);

  // ---- Filter content groups when subject changes -------------------------
  useEffect(() => {
    if (aiLockRef.current) return; // Don't interfere with AI result
    if (!selectedSubjectId) {
      setContentGroups([]);
      return;
    }
    const filtered = allContentGroups.filter(
      (cg) => cg.subject_id === selectedSubjectId
    );
    setContentGroups(filtered);
    if (filtered.length > 0 && !filtered.some((cg) => cg.id === selectedContentGroupId)) {
      setSelectedContentGroupId(filtered[0].id);
    } else if (filtered.length === 0) {
      setSelectedContentGroupId("");
    }
  }, [selectedSubjectId, allContentGroups, selectedContentGroupId, setContentGroups, setSelectedContentGroupId]);

  // ---- Load units when content group changes ------------------------------
  useEffect(() => {
    if (aiLockRef.current) return; // AI already loaded units directly
    if (!selectedContentGroupId) {
      setUnits([]);
      return;
    }
    supabase
      .from("units")
      .select("id, name, unit_number, content_group_id")
      .eq("content_group_id", selectedContentGroupId)
      .order("unit_number")
      .then(({ data }) => {
        if (data) setUnits(data as Unit[]);
      });
  }, [selectedContentGroupId, supabase, setUnits]);

  return {
    supabase,
    aiLockRef,
    students,
    subjects,
    allContentGroups,
  };
}
