import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Parse & validate query params
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const subjectFilter = url.searchParams.get("subject"); // optional subject_id

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !dateRegex.test(from)) {
    return NextResponse.json({ error: "Invalid 'from' date format" }, { status: 400 });
  }
  if (to && !dateRegex.test(to)) {
    return NextResponse.json({ error: "Invalid 'to' date format" }, { status: 400 });
  }
  if (from && to && from > to) {
    return NextResponse.json({ error: "'from' must be <= 'to'" }, { status: 400 });
  }

  // Fetch student
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name, grade")
    .eq("id", id)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Fetch student subjects → content groups → units
  const { data: studentSubjects, error: ssError } = await supabase
    .from("student_subjects")
    .select("subject_id, subjects(id, name, display_order)")
    .eq("student_id", id);

  if (ssError) {
    return NextResponse.json({ error: "Failed to load subjects" }, { status: 500 });
  }

  interface SubjectInfo { id: string; name: string; display_order: number }

  const subjects: SubjectInfo[] = (studentSubjects ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((ss: any) => ss.subjects as SubjectInfo)
    .filter((s: SubjectInfo | null): s is SubjectInfo => s != null)
    .sort((a: SubjectInfo, b: SubjectInfo) => a.display_order - b.display_order);

  // Apply subject filter if provided
  const filteredSubjects = subjectFilter
    ? subjects.filter((s) => s.id === subjectFilter)
    : subjects;

  const subjectIds = filteredSubjects.map((s) => s.id);
  if (subjectIds.length === 0) {
    return NextResponse.json({ error: "No subjects found" }, { status: 404 });
  }

  const { data: allContentGroups, error: cgError } = await supabase
    .from("content_groups")
    .select("id, subject_id, name, display_order")
    .in("subject_id", subjectIds)
    .order("display_order");

  if (cgError) {
    return NextResponse.json({ error: "Failed to load content groups" }, { status: 500 });
  }

  const cgIds = (allContentGroups ?? []).map((cg: { id: string }) => cg.id);

  const { data: allUnits, error: unitError } = await supabase
    .from("units")
    .select("id, name, unit_number, content_group_id")
    .in("content_group_id", cgIds.length > 0 ? cgIds : ["_none_"])
    .order("unit_number");

  if (unitError) {
    return NextResponse.json({ error: "Failed to load units" }, { status: 500 });
  }

  // Fetch records with date filter
  let query = supabase
    .from("lesson_records")
    .select(
      "id, unit_id, step_type, score, max_score, lesson_date, completion_type, comment, users!inner(display_name)"
    )
    .eq("student_id", id)
    .order("lesson_date", { ascending: true });

  if (from) query = query.gte("lesson_date", from);
  if (to) query = query.lte("lesson_date", to);

  const { data: records, error: recError } = await query;
  if (recError) {
    return NextResponse.json({ error: "Failed to load records" }, { status: 500 });
  }
  const allRecords = records ?? [];

  // Build lookup maps
  interface UnitInfo { id: string; name: string; unit_number: number; content_group_id: string }
  interface CGInfo { id: string; subject_id: string; name: string; display_order: number }

  const unitMap = new Map((allUnits ?? []).map((u: UnitInfo) => [u.id, u]));
  const cgMap = new Map((allContentGroups ?? []).map((cg: CGInfo) => [cg.id, cg]));

  // Pre-group records by subject_id
  const recordsBySubject = new Map<string, typeof allRecords>();
  for (const r of allRecords) {
    const unit = unitMap.get(r.unit_id);
    if (!unit) continue;
    const cg = cgMap.get(unit.content_group_id);
    if (!cg) continue;
    const sid = cg.subject_id;
    if (!recordsBySubject.has(sid)) recordsBySubject.set(sid, []);
    recordsBySubject.get(sid)!.push(r);
  }

  const stepLabel = (t: string) => {
    if (t === "learning") return "L";
    if (t === "step1") return "S1";
    if (t === "step2") return "S2";
    return t;
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Date range display
  const dateRange = from && to
    ? `${from} 〜 ${to}`
    : from
    ? `${from} 〜`
    : to
    ? `〜 ${to}`
    : "全期間";

  const generatedDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

  // =========================================================================
  // Generate print-friendly HTML
  // =========================================================================
  let subjectSections = "";

  for (const subject of filteredSubjects) {
    const subjectRecords = recordsBySubject.get(subject.id) ?? [];
    if (subjectRecords.length === 0) continue;

    const subjectCGs = (allContentGroups ?? []).filter(
      (cg: CGInfo) => cg.subject_id === subject.id
    );

    // Table rows
    let rows = "";
    for (const record of subjectRecords) {
      const unit = unitMap.get(record.unit_id);
      const cg = unit ? cgMap.get(unit.content_group_id) : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instructor = (record as any).users?.display_name ?? "";
      const scoreStr = record.score != null ? `${record.score}/${record.max_score}` : "—";

      rows += `<tr>
        <td>${escapeHtml(record.lesson_date.slice(5))}</td>
        <td>${escapeHtml(cg?.name ?? "")}</td>
        <td>${escapeHtml(unit?.name ?? "")}</td>
        <td class="center">${escapeHtml(stepLabel(record.step_type))}</td>
        <td class="center">${escapeHtml(scoreStr)}</td>
        <td>${escapeHtml(instructor)}</td>
      </tr>`;
    }

    // Progress
    const completedUnits = new Set(
      subjectRecords
        .filter((r) => r.completion_type != null)
        .map((r) => r.unit_id)
    ).size;
    const totalUnits = (allUnits ?? []).filter((u: UnitInfo) =>
      subjectCGs.some((cg: CGInfo) => cg.id === u.content_group_id)
    ).length;
    const pct = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    // Comments (latest 3)
    const comments = subjectRecords
      .filter((r) => r.comment && r.comment.trim())
      .slice(-3);

    let commentHtml = "";
    if (comments.length > 0) {
      commentHtml = `<div class="comments"><strong>講師コメント:</strong><ul>`;
      for (const c of comments) {
        const unit = unitMap.get(c.unit_id);
        commentHtml += `<li>${escapeHtml(c.lesson_date.slice(5))} ${escapeHtml(unit?.name?.slice(0, 20) ?? "")}: ${escapeHtml((c.comment ?? "").slice(0, 80))}</li>`;
      }
      commentHtml += `</ul></div>`;
    }

    subjectSections += `
      <div class="subject-section">
        <h2>${escapeHtml(subject.name)}</h2>
        <table>
          <thead>
            <tr><th>日付</th><th>教材</th><th>単元</th><th class="center">種別</th><th class="center">点数</th><th>担当</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="progress-section">
          <span>進捗: ${completedUnits}/${totalUnits} 完了 (${pct}%)</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        ${commentHtml}
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>学習レポート - ${escapeHtml(student.name)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    font-size: 10px;
    color: #1e293b;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #3b82f6;
    padding-bottom: 10px;
    margin-bottom: 16px;
  }
  .header h1 { font-size: 18px; color: #3b82f6; }
  .header .subtitle { font-size: 10px; color: #64748b; }
  .student-info {
    display: flex;
    gap: 24px;
    margin-bottom: 6px;
    font-size: 11px;
  }
  .student-info strong { font-size: 14px; }
  .meta { font-size: 9px; color: #64748b; margin-bottom: 16px; }
  .subject-section { margin-bottom: 20px; page-break-inside: avoid; }
  .subject-section h2 {
    font-size: 13px;
    color: #3b82f6;
    border-left: 3px solid #3b82f6;
    padding-left: 8px;
    margin-bottom: 8px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 8px; }
  th { background: #f1f5f9; padding: 4px 6px; text-align: left; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
  td { padding: 3px 6px; border-bottom: 1px solid #f1f5f9; }
  .center { text-align: center; }
  tr:nth-child(even) { background: #fafbfc; }
  .progress-section {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 9px;
    color: #475569;
    margin-bottom: 6px;
  }
  .progress-bar {
    flex: 1;
    max-width: 200px;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill { height: 100%; background: #3b82f6; border-radius: 3px; }
  .comments { font-size: 9px; color: #475569; margin-top: 4px; }
  .comments ul { padding-left: 16px; }
  .comments li { margin-bottom: 2px; }
  .footer {
    margin-top: 24px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 8px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }
  @media print {
    body { font-size: 9px; }
    .no-print { display: none !important; }
  }
  .print-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    padding: 8px 20px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .print-btn:hover { background: #2563eb; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">PDF保存 / 印刷</button>

<div class="header">
  <div>
    <h1>Lesson Track</h1>
    <div class="subtitle">学習レポート</div>
  </div>
</div>

<div class="student-info">
  <div><strong>${escapeHtml(student.name)}</strong></div>
  <div>${escapeHtml(student.grade)}</div>
</div>
<div class="meta">期間: ${escapeHtml(dateRange)} ｜ 記録数: ${allRecords.length}件 ｜ 出力日: ${generatedDate}</div>

${subjectSections}

${subjectSections.length === 0 ? '<p style="text-align:center;color:#94a3b8;padding:40px 0;">この期間の記録はありません</p>' : ''}

<div class="footer">
  <span>Lesson Track - 学習レポート</span>
  <span>出力日: ${generatedDate}</span>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
