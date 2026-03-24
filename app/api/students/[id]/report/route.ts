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
    if (t === "learning") return "ラーニング";
    if (t === "step1") return "ステップ1";
    if (t === "step2") return "ステップ2";
    return t;
  };

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** Format YYYY-MM-DD to "M月D日" */
  const formatDate = (d: string) => {
    const [, m, day] = d.split("-");
    return `${Number(m)}月${Number(day)}日`;
  };

  /** Format YYYY-MM-DD to "YYYY年M月D日" */
  const formatDateFull = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${y}年${Number(m)}月${Number(day)}日`;
  };

  // Date range display
  const dateRange = from && to
    ? `${formatDateFull(from)} 〜 ${formatDateFull(to)}`
    : from
    ? `${formatDateFull(from)} 〜`
    : to
    ? `〜 ${formatDateFull(to)}`
    : "全期間";

  const generatedDate = new Date().toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Score percentage for color coding
  const scoreColor = (score: number | null, maxScore: number | null): string => {
    if (score == null || maxScore == null || maxScore === 0) return "";
    const pct = score / maxScore;
    if (pct >= 0.8) return "score-high";
    if (pct >= 0.6) return "score-mid";
    return "score-low";
  };

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
      const sColor = scoreColor(record.score, record.max_score);

      rows += `<tr>
        <td class="date-col">${escapeHtml(formatDate(record.lesson_date))}</td>
        <td class="cg-col">${escapeHtml(cg?.name ?? "")}</td>
        <td>${escapeHtml(unit?.name ?? "")}</td>
        <td class="center step-col"><span class="step-badge">${escapeHtml(stepLabel(record.step_type))}</span></td>
        <td class="center score-col ${sColor}">${escapeHtml(scoreStr)}</td>
        <td class="instructor-col">${escapeHtml(instructor)}</td>
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
      commentHtml = `<div class="comment-box">
        <div class="comment-title">講師からのコメント</div>`;
      for (const c of comments) {
        const cUnit = unitMap.get(c.unit_id);
        commentHtml += `<div class="comment-item">
          <span class="comment-date">${escapeHtml(formatDate(c.lesson_date))}</span>
          <span class="comment-unit">${escapeHtml(cUnit?.name?.slice(0, 25) ?? "")}</span>
          <p class="comment-text">${escapeHtml((c.comment ?? "").slice(0, 100))}</p>
        </div>`;
      }
      commentHtml += `</div>`;
    }

    // Summary stats
    const avgScore = subjectRecords.filter((r) => r.score != null && r.max_score != null && r.max_score > 0);
    const avgPct = avgScore.length > 0
      ? Math.round(avgScore.reduce((sum, r) => sum + (r.score! / r.max_score!) * 100, 0) / avgScore.length)
      : null;

    subjectSections += `
      <div class="subject-section">
        <div class="subject-header">
          <h2>${escapeHtml(subject.name)}</h2>
          <div class="subject-stats">
            <span>記録 <strong>${subjectRecords.length}</strong>件</span>
            ${avgPct != null ? `<span>平均 <strong>${avgPct}%</strong></span>` : ''}
          </div>
        </div>
        <table>
          <thead>
            <tr><th class="date-col">日付</th><th class="cg-col">教材</th><th>単元</th><th class="center step-col">種別</th><th class="center score-col">点数</th><th class="instructor-col">担当</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="progress-row">
          <div class="progress-label">進捗</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-value">${completedUnits}/${totalUnits} 完了（${pct}%）</div>
        </div>
        ${commentHtml}
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>学習レポート - ${escapeHtml(student.name)}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", "Yu Gothic", sans-serif;
    font-size: 10px;
    color: #1e293b;
    line-height: 1.6;
    background: #f8fafc;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    max-width: 210mm;
    margin: 0 auto;
    background: white;
    padding: 24px 28px;
    min-height: 100vh;
  }
  @media print {
    .page { padding: 0; background: none; min-height: auto; box-shadow: none; }
    body { background: none; margin: 0; padding: 0; }
    .print-btn { display: none !important; }
  }

  /* ===== Header ===== */
  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    margin-bottom: 20px;
    border-bottom: 3px solid #1e3a5f;
  }
  .report-header .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .report-header .brand-icon {
    width: 36px; height: 36px;
    background: #1e3a5f;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .report-header .brand-icon svg {
    width: 20px; height: 20px; fill: white;
  }
  .report-header .brand-text h1 {
    font-size: 16px;
    font-weight: 700;
    color: #1e3a5f;
    letter-spacing: -0.02em;
  }
  .report-header .brand-text .tagline {
    font-size: 9px;
    color: #64748b;
    font-weight: 400;
  }
  .report-header .report-type {
    font-size: 11px;
    color: #475569;
    text-align: right;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  /* ===== Student Card ===== */
  .student-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .student-card .name {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }
  .student-card .grade {
    display: inline-block;
    background: #1e3a5f;
    color: white;
    font-size: 9px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 10px;
    margin-left: 10px;
  }
  .student-card .meta-right {
    text-align: right;
    font-size: 9px;
    color: #64748b;
    line-height: 1.8;
  }

  /* ===== Subject Section ===== */
  .subject-section {
    margin-bottom: 24px;
    page-break-inside: avoid;
  }
  .subject-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .subject-header h2 {
    font-size: 13px;
    font-weight: 700;
    color: #1e3a5f;
    padding-left: 10px;
    border-left: 4px solid #3b82f6;
  }
  .subject-stats {
    display: flex;
    gap: 16px;
    font-size: 9px;
    color: #64748b;
  }
  .subject-stats strong { color: #1e293b; }

  /* ===== Table ===== */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin-bottom: 10px;
  }
  thead { border-bottom: 2px solid #e2e8f0; }
  th {
    background: #f1f5f9;
    padding: 6px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 8px;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td {
    padding: 5px 8px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  tr:nth-child(even) { background: #fafbfd; }
  tr:hover { background: #f1f5f9; }
  .center { text-align: center; }
  .date-col { width: 60px; white-space: nowrap; color: #64748b; }
  .cg-col { width: 100px; font-size: 8px; color: #64748b; }
  .step-col { width: 70px; }
  .score-col { width: 55px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .instructor-col { width: 50px; font-size: 8px; color: #64748b; }
  .step-badge {
    display: inline-block;
    font-size: 8px;
    padding: 1px 6px;
    border-radius: 4px;
    background: #e2e8f0;
    color: #475569;
    font-weight: 500;
  }
  .score-high { color: #059669; }
  .score-mid { color: #d97706; }
  .score-low { color: #dc2626; }

  /* ===== Progress ===== */
  .progress-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .progress-label {
    font-size: 9px;
    font-weight: 600;
    color: #475569;
    width: 32px;
  }
  .progress-bar {
    flex: 1;
    max-width: 180px;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #2563eb);
    border-radius: 4px;
    transition: width 0.3s;
  }
  .progress-value {
    font-size: 9px;
    color: #475569;
    font-variant-numeric: tabular-nums;
  }

  /* ===== Comments ===== */
  .comment-box {
    background: #fefce8;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 10px 14px;
    margin-top: 6px;
  }
  .comment-title {
    font-size: 9px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 6px;
  }
  .comment-item {
    margin-bottom: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid #fef3c7;
  }
  .comment-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .comment-date {
    font-size: 8px;
    color: #92400e;
    font-weight: 600;
    margin-right: 6px;
  }
  .comment-unit {
    font-size: 8px;
    color: #a16207;
  }
  .comment-text {
    font-size: 9px;
    color: #78350f;
    margin-top: 2px;
    line-height: 1.5;
  }

  /* ===== Footer ===== */
  .report-footer {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 2px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    color: #94a3b8;
  }
  .report-footer .confidential {
    font-size: 7px;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* ===== Print button ===== */
  .print-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    padding: 10px 24px;
    background: #1e3a5f;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: inherit;
  }
  .print-btn:hover { background: #15294a; }
  @media print { .no-print { display: none !important; } }
  @page { margin: 15mm 10mm; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">PDF保存 / 印刷</button>

<div class="page">
  <!-- Header -->
  <div class="report-header">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </div>
      <div class="brand-text">
        <h1>東進育英舎</h1>
        <div class="tagline">単元別教科講座</div>
      </div>
    </div>
    <div class="report-type">学習レポート</div>
  </div>

  <!-- Student Card -->
  <div class="student-card">
    <div>
      <span class="name">${escapeHtml(student.name)}</span>
      <span class="grade">${escapeHtml(student.grade)}</span>
    </div>
    <div class="meta-right">
      期間: ${escapeHtml(dateRange)}<br>
      記録数: ${[...recordsBySubject.values()].reduce((sum, recs) => sum + recs.length, 0)}件
    </div>
  </div>

  <!-- Subject Sections -->
  ${subjectSections}

  ${subjectSections.length === 0 ? '<p style="text-align:center;color:#94a3b8;padding:40px 0;font-size:12px;">この期間の記録はありません</p>' : ''}

  <!-- Footer -->
  <div class="report-footer">
    <span>東進育英舎 — ${generatedDate} 出力</span>
    <span class="confidential">CONFIDENTIAL</span>
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
