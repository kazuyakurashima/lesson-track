import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse query params for date range
  const url = new URL(request.url);
  const from = url.searchParams.get("from"); // YYYY-MM-DD
  const to = url.searchParams.get("to"); // YYYY-MM-DD

  // Fetch student
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade")
    .eq("id", id)
    .single();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Fetch student subjects → content groups → units
  const { data: studentSubjects } = await supabase
    .from("student_subjects")
    .select("subject_id, subjects(id, name, display_order)")
    .eq("student_id", id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subjects = (studentSubjects ?? [])
    .map((ss: any) => ss.subjects)
    .sort((a: any, b: any) => a.display_order - b.display_order);

  const subjectIds = subjects.map((s: { id: string }) => s.id);

  const { data: allContentGroups } = await supabase
    .from("content_groups")
    .select("id, subject_id, name, display_order")
    .in("subject_id", subjectIds.length > 0 ? subjectIds : ["_none_"])
    .order("display_order");

  const { data: allUnits } = await supabase
    .from("units")
    .select("id, name, unit_number, content_group_id")
    .in(
      "content_group_id",
      (allContentGroups ?? []).map((cg: { id: string }) => cg.id).length > 0
        ? (allContentGroups ?? []).map((cg: { id: string }) => cg.id)
        : ["_none_"]
    )
    .order("unit_number");

  // Fetch records with optional date filter
  let query = supabase
    .from("lesson_records")
    .select(
      "id, unit_id, step_type, score, max_score, lesson_date, completion_type, comment, users!inner(display_name)"
    )
    .eq("student_id", id)
    .order("lesson_date", { ascending: true });

  if (from) query = query.gte("lesson_date", from);
  if (to) query = query.lte("lesson_date", to);

  const { data: records } = await query;
  const allRecords = records ?? [];

  // Build lookup maps
  const unitMap = new Map(
    (allUnits ?? []).map((u: { id: string; name: string; unit_number: number; content_group_id: string }) => [u.id, u])
  );
  const cgMap = new Map(
    (allContentGroups ?? []).map((cg: { id: string; subject_id: string; name: string }) => [cg.id, cg])
  );

  // Step label
  const stepLabel = (t: string) => {
    if (t === "learning") return "L";
    if (t === "step1") return "S1";
    if (t === "step2") return "S2";
    return t;
  };

  // =========================================================================
  // Generate PDF
  // =========================================================================
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- Helper functions ---
  function addPageIfNeeded(requiredSpace: number) {
    if (y + requiredSpace > 280) {
      doc.addPage();
      y = margin;
    }
  }

  function drawLine(yPos: number) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, margin + contentWidth, yPos);
  }

  // --- Header ---
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Lesson Track", margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Learning Report", margin, y);
  y += 4;
  drawLine(y);
  y += 6;

  // --- Student info ---
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(`${student.name}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${student.grade}`, margin + 50, y);
  y += 5;

  // Date range
  const dateRange = from && to ? `${from} - ${to}` : from ? `${from} -` : to ? `- ${to}` : "All records";
  doc.setFontSize(8);
  doc.text(`Period: ${dateRange}`, margin, y);
  y += 3;
  doc.text(`Records: ${allRecords.length}`, margin, y);
  y += 6;
  drawLine(y);
  y += 6;

  // --- Per subject section ---
  for (const subject of subjects) {
    const subjectCGs = (allContentGroups ?? []).filter(
      (cg: { subject_id: string }) => cg.subject_id === subject.id
    );
    const subjectRecords = allRecords.filter((r) => {
      const unit = unitMap.get(r.unit_id);
      if (!unit) return false;
      const cg = cgMap.get(unit.content_group_id);
      return cg?.subject_id === subject.id;
    });

    if (subjectRecords.length === 0) continue;

    addPageIfNeeded(30);

    // Subject header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246); // primary blue
    doc.text(subject.name, margin, y);
    y += 6;

    // Table header
    const cols = [
      { label: "Date", x: margin, w: 22 },
      { label: "Content", x: margin + 22, w: 35 },
      { label: "Unit", x: margin + 57, w: 60 },
      { label: "Step", x: margin + 117, w: 12 },
      { label: "Score", x: margin + 129, w: 20 },
      { label: "Instructor", x: margin + 149, w: 31 },
    ];

    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y - 3.5, contentWidth, 5.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    for (const col of cols) {
      doc.text(col.label, col.x + 1, y);
    }
    y += 4;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    for (const record of subjectRecords) {
      addPageIfNeeded(6);

      const unit = unitMap.get(record.unit_id);
      const cg = unit ? cgMap.get(unit.content_group_id) : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instructor = (record as any).users?.display_name ?? "";
      const scoreStr =
        record.score != null ? `${record.score}/${record.max_score}` : "-";

      doc.setTextColor(0, 0, 0);
      doc.text(record.lesson_date.slice(5), cols[0].x + 1, y); // MM-DD
      doc.text((cg?.name ?? "").slice(0, 18), cols[1].x + 1, y);
      doc.text((unit?.name ?? "").slice(0, 30), cols[2].x + 1, y);
      doc.text(stepLabel(record.step_type), cols[3].x + 1, y);
      doc.text(scoreStr, cols[4].x + 1, y);
      doc.text(instructor.slice(0, 10), cols[5].x + 1, y);
      y += 4;
    }

    // Progress summary
    y += 2;
    const completedUnits = new Set(
      subjectRecords
        .filter((r) => r.completion_type != null)
        .map((r) => r.unit_id)
    ).size;
    const totalUnits = (allUnits ?? []).filter((u: { content_group_id: string }) =>
      subjectCGs.some((cg: { id: string }) => cg.id === u.content_group_id)
    ).length;
    const pct = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    addPageIfNeeded(12);
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`Progress: ${completedUnits}/${totalUnits} completed (${pct}%)`, margin, y);
    y += 4;

    // Progress bar
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(margin, y, contentWidth * 0.5, 2.5, 1, 1, "F");
    if (pct > 0) {
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(margin, y, contentWidth * 0.5 * (pct / 100), 2.5, 1, 1, "F");
    }
    y += 6;

    // Comments from this subject's records
    const comments = subjectRecords
      .filter((r) => r.comment && r.comment.trim())
      .slice(-3); // latest 3

    if (comments.length > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("Comments:", margin, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      for (const c of comments) {
        addPageIfNeeded(5);
        const unit = unitMap.get(c.unit_id);
        doc.text(
          `${c.lesson_date.slice(5)} ${unit?.name?.slice(0, 15) ?? ""}: ${(c.comment ?? "").slice(0, 50)}`,
          margin + 2,
          y
        );
        y += 3.5;
      }
    }

    y += 4;
    drawLine(y);
    y += 6;
  }

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `Lesson Track - Generated ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" })}`,
      margin,
      290
    );
    doc.text(`${i}/${pageCount}`, pageWidth - margin - 10, 290);
  }

  // Return PDF
  const pdfBuffer = doc.output("arraybuffer");

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${student.name}_report.pdf"`,
    },
  });
}
