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

  const { data: allContentGroupsRaw, error: cgError } = await supabase
    .from("content_groups")
    .select("id, subject_id, name, display_order")
    .in("subject_id", subjectIds)
    .order("display_order");

  if (cgError) {
    return NextResponse.json({ error: "Failed to load content groups" }, { status: 500 });
  }

  // Load student's selected content groups
  const { data: studentCGs } = await supabase
    .from("student_content_groups")
    .select("content_group_id")
    .eq("student_id", id);
  const selectedCGIds = new Set((studentCGs ?? []).map((scg: { content_group_id: string }) => scg.content_group_id));

  // Per-subject fallback: if a subject has any CG selected, show only those;
  // if no CGs selected for that subject, show all CGs under it
  const allContentGroups = (allContentGroupsRaw ?? []).filter((cg: { id: string; subject_id: string }) => {
    if (selectedCGIds.size === 0) return true;
    const subjectHasSelections = (allContentGroupsRaw ?? []).some(
      (other: { id: string; subject_id: string }) => other.subject_id === cg.subject_id && selectedCGIds.has(other.id)
    );
    return subjectHasSelections ? selectedCGIds.has(cg.id) : true;
  });

  const cgIds = allContentGroups.map((cg: { id: string }) => cg.id);

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
  // Build lookup maps
  interface UnitInfo { id: string; name: string; unit_number: number; content_group_id: string }
  interface CGInfo { id: string; subject_id: string; name: string; display_order: number }

  const unitMap = new Map((allUnits ?? []).map((u: UnitInfo) => [u.id, u]));

  // Filter records to only include units from visible content groups
  const visibleUnitIds = new Set((allUnits ?? []).map((u: UnitInfo) => u.id));
  const allRecords = (records ?? []).filter((r: { unit_id: string }) => visibleUnitIds.has(r.unit_id));
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
  // Build per-CG stats for summary
  // =========================================================================
  interface CGStat {
    cgName: string;
    subjectName: string;
    totalUnits: number;
    completedUnits: number;
    recordCount: number;
    avgPct: number | null;
  }

  const cgStats: CGStat[] = [];
  const recordsByCG = new Map<string, typeof allRecords>();

  for (const r of allRecords) {
    const unit = unitMap.get(r.unit_id);
    if (!unit) continue;
    const cgId = unit.content_group_id;
    if (!recordsByCG.has(cgId)) recordsByCG.set(cgId, []);
    recordsByCG.get(cgId)!.push(r);
  }

  for (const subject of filteredSubjects) {
    const subjectCGs = (allContentGroups ?? []).filter(
      (cg: CGInfo) => cg.subject_id === subject.id
    );
    for (const cg of subjectCGs) {
      const cgRecords = recordsByCG.get(cg.id) ?? [];
      const cgUnits = (allUnits ?? []).filter((u: UnitInfo) => u.content_group_id === cg.id);
      const completed = new Set(
        cgRecords.filter((r) => r.completion_type != null).map((r) => r.unit_id)
      ).size;
      const scored = cgRecords.filter((r) => r.score != null && r.max_score != null && r.max_score! > 0);
      const avg = scored.length > 0
        ? Math.round(scored.reduce((s, r) => s + (r.score! / r.max_score!) * 100, 0) / scored.length)
        : null;

      if (cgRecords.length > 0 || cgUnits.length > 0) {
        cgStats.push({
          cgName: cg.name,
          subjectName: subject.name,
          totalUnits: cgUnits.length,
          completedUnits: completed,
          recordCount: cgRecords.length,
          avgPct: avg,
        });
      }
    }
  }

  // =========================================================================
  // Summary section HTML
  // =========================================================================
  const totalRecords = allRecords.length;
  const allScored = allRecords.filter((r) => r.score != null && r.max_score != null && r.max_score! > 0);
  const overallAvg = allScored.length > 0
    ? Math.round(allScored.reduce((s, r) => s + (r.score! / r.max_score!) * 100, 0) / allScored.length)
    : null;
  const uniqueDates = new Set(allRecords.map((r) => r.lesson_date)).size;

  let summaryRows = "";
  for (const stat of cgStats) {
    const pct = stat.totalUnits > 0 ? Math.round((stat.completedUnits / stat.totalUnits) * 100) : 0;
    summaryRows += `<tr>
      <td class="subject-label">${escapeHtml(stat.subjectName)}</td>
      <td>${escapeHtml(stat.cgName)}</td>
      <td class="center num-col">${stat.completedUnits}/${stat.totalUnits}</td>
      <td class="progress-cell">
        <div class="mini-bar"><div class="mini-fill" style="width:${pct}%"></div></div>
        <span class="mini-pct">${pct}%</span>
      </td>
      <td class="center num-col">${stat.avgPct != null ? `<span class="${stat.avgPct >= 80 ? 'score-high' : stat.avgPct >= 60 ? 'score-mid' : 'score-low'}">${stat.avgPct}%</span>` : '—'}</td>
      <td class="center num-col">${stat.recordCount}</td>
    </tr>`;
  }

  const summarySection = `
  <div class="summary-section">
    <h2 class="section-title">学習概要</h2>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-value">${totalRecords}</div><div class="kpi-label">学習記録数</div></div>
      <div class="kpi"><div class="kpi-value">${uniqueDates}</div><div class="kpi-label">学習日数</div></div>
      <div class="kpi"><div class="kpi-value">${overallAvg != null ? overallAvg + '%' : '—'}</div><div class="kpi-label">全体平均正答率</div></div>
    </div>
    <table class="summary-table">
      <thead><tr><th>科目</th><th>教材</th><th class="center">進捗</th><th>達成度</th><th class="center">正答率</th><th class="center">記録数</th></tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>`;

  // =========================================================================
  // Detail sections HTML
  // =========================================================================
  let subjectSections = "";

  for (const subject of filteredSubjects) {
    const subjectRecords = recordsBySubject.get(subject.id) ?? [];
    if (subjectRecords.length === 0) continue;

    // Group records by unit, keeping only the latest record per unit+step_type
    // Then sort by content_group display_order → unit_number
    const latestByUnitStep = new Map<string, typeof subjectRecords[0]>();
    for (const record of subjectRecords) {
      const key = `${record.unit_id}:${record.step_type}`;
      const existing = latestByUnitStep.get(key);
      if (!existing || record.lesson_date > existing.lesson_date) {
        latestByUnitStep.set(key, record);
      }
    }
    const dedupedRecords = [...latestByUnitStep.values()];

    // Sort by CG display_order → unit_number → step order
    const stepOrder: Record<string, number> = { learning: 0, step1: 1, step2: 2 };
    dedupedRecords.sort((a, b) => {
      const unitA = unitMap.get(a.unit_id);
      const unitB = unitMap.get(b.unit_id);
      const cgA = unitA ? cgMap.get(unitA.content_group_id) : null;
      const cgB = unitB ? cgMap.get(unitB.content_group_id) : null;
      const cgOrder = (cgA?.display_order ?? 0) - (cgB?.display_order ?? 0);
      if (cgOrder !== 0) return cgOrder;
      const unitOrder = (unitA?.unit_number ?? 0) - (unitB?.unit_number ?? 0);
      if (unitOrder !== 0) return unitOrder;
      return (stepOrder[a.step_type] ?? 0) - (stepOrder[b.step_type] ?? 0);
    });

    // Table rows
    let rows = "";
    for (const record of dedupedRecords) {
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

    subjectSections += `
      <div class="subject-section">
        <div class="subject-header">
          <h2>${escapeHtml(subject.name)}</h2>
          <span class="record-count">${subjectRecords.length}件</span>
        </div>
        <table>
          <thead>
            <tr><th class="date-col">日付</th><th class="cg-col">教材</th><th>単元</th><th class="center step-col">種別</th><th class="center score-col">点数</th><th class="instructor-col">担当</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${commentHtml}
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>学習レポート - ${escapeHtml(student.name)} | 東進育英舎</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
    font-size: 10px;
    color: #1e293b;
    line-height: 1.55;
    background: #f1f5f9;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    max-width: 210mm;
    margin: 0 auto;
    background: white;
    padding: 20px 24px;
  }
  @media screen { .page { box-shadow: 0 1px 8px rgba(0,0,0,.08); margin-top: 12px; margin-bottom: 12px; } }
  @media print {
    body { background: none; margin: 0; padding: 0; }
    .page { padding: 0; box-shadow: none; }
    .no-print { display: none !important; }
  }

  /* ===== Header ===== */
  .report-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 12px; margin-bottom: 16px;
    border-bottom: 2.5px solid #1e3a5f;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-icon {
    width: 32px; height: 32px; background: #1e3a5f; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
  }
  .brand-icon svg { width: 18px; height: 18px; fill: white; }
  .brand-text h1 { font-size: 15px; font-weight: 700; color: #1e3a5f; letter-spacing: -0.01em; }
  .brand-text .tagline { font-size: 8px; color: #64748b; }
  .report-type { font-size: 10px; color: #475569; font-weight: 600; letter-spacing: 0.05em; }

  /* ===== Student Card ===== */
  .student-card {
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
    border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 12px 16px; margin-bottom: 16px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .student-card .name { font-size: 15px; font-weight: 700; color: #0f172a; }
  .student-card .grade {
    display: inline-block; background: #1e3a5f; color: white;
    font-size: 8px; font-weight: 600; padding: 2px 9px; border-radius: 10px; margin-left: 8px;
  }
  .student-card .meta-right { text-align: right; font-size: 8px; color: #64748b; line-height: 1.7; }

  /* ===== Section Title ===== */
  .section-title {
    font-size: 12px; font-weight: 700; color: #1e3a5f;
    padding-left: 9px; border-left: 3.5px solid #3b82f6;
    margin-bottom: 10px;
  }

  /* ===== KPI Row ===== */
  .kpi-row {
    display: flex; gap: 12px; margin-bottom: 12px;
  }
  .kpi {
    flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
    padding: 10px 12px; text-align: center;
  }
  .kpi-value { font-size: 20px; font-weight: 700; color: #1e3a5f; font-variant-numeric: tabular-nums; }
  .kpi-label { font-size: 8px; color: #64748b; margin-top: 2px; }

  /* ===== Summary Table ===== */
  .summary-section { margin-bottom: 20px; }
  .summary-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .summary-table th {
    background: #1e3a5f; color: white; padding: 5px 8px;
    text-align: left; font-size: 8px; font-weight: 600; letter-spacing: 0.03em;
  }
  .summary-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  .summary-table tr:nth-child(even) { background: #f8fafc; }
  .subject-label { font-weight: 600; color: #1e3a5f; white-space: nowrap; }
  .num-col { width: 55px; font-variant-numeric: tabular-nums; }
  .progress-cell { width: 120px; }
  .mini-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; display: inline-block; width: 70px; vertical-align: middle; }
  .mini-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); border-radius: 3px; }
  .mini-pct { font-size: 8px; color: #475569; margin-left: 4px; font-variant-numeric: tabular-nums; }

  /* ===== Detail Divider ===== */
  .detail-divider {
    margin: 18px 0 14px; padding-top: 14px;
    border-top: 1.5px solid #e2e8f0;
  }
  .detail-divider .section-title { color: #475569; font-size: 11px; }

  /* ===== Subject Section ===== */
  .subject-section { margin-bottom: 18px; page-break-inside: avoid; }
  .subject-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 6px;
  }
  .subject-header h2 {
    font-size: 11px; font-weight: 700; color: #1e3a5f;
    padding-left: 8px; border-left: 3px solid #3b82f6;
  }
  .record-count { font-size: 8px; color: #64748b; }

  /* ===== Detail Table ===== */
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 8px; }
  thead { border-bottom: 2px solid #e2e8f0; }
  th {
    background: #f1f5f9; padding: 5px 7px; text-align: left;
    font-weight: 600; font-size: 8px; color: #475569; letter-spacing: 0.03em;
  }
  td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:nth-child(even) { background: #fafbfd; }
  .center { text-align: center; }
  .date-col { width: 55px; white-space: nowrap; color: #64748b; }
  .cg-col { width: 90px; font-size: 8px; color: #64748b; }
  .step-col { width: 65px; }
  .score-col { width: 50px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .instructor-col { width: 45px; font-size: 8px; color: #64748b; }
  .step-badge {
    display: inline-block; font-size: 7px; padding: 1px 5px;
    border-radius: 3px; background: #e2e8f0; color: #475569; font-weight: 500;
  }
  .score-high { color: #059669; font-weight: 700; }
  .score-mid { color: #d97706; }
  .score-low { color: #dc2626; }

  /* ===== Comments ===== */
  .comment-box {
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 5px;
    padding: 8px 12px; margin-top: 4px;
  }
  .comment-title { font-size: 8px; font-weight: 700; color: #92400e; margin-bottom: 4px; }
  .comment-item { margin-bottom: 3px; padding-bottom: 3px; border-bottom: 1px solid #fef3c7; }
  .comment-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .comment-date { font-size: 7px; color: #92400e; font-weight: 600; margin-right: 4px; }
  .comment-unit { font-size: 7px; color: #a16207; }
  .comment-text { font-size: 8px; color: #78350f; margin-top: 1px; line-height: 1.4; }

  /* ===== Footer ===== */
  .report-footer {
    margin-top: 20px; padding-top: 8px; border-top: 1.5px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 7px; color: #94a3b8;
  }

  /* ===== Print button ===== */
  .print-btn {
    position: fixed; top: 12px; right: 12px; padding: 8px 20px;
    background: #1e3a5f; color: white; border: none; border-radius: 6px;
    font-size: 12px; font-weight: 600; cursor: pointer; z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,.15); font-family: inherit;
  }
  .print-btn:hover { background: #15294a; }
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
        <div class="tagline">単元別強化講座</div>
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
      出力日: ${generatedDate}
    </div>
  </div>

  <!-- Summary -->
  ${summarySection}

  <!-- Detail Divider -->
  <div class="detail-divider">
    <h2 class="section-title">科目別 学習記録</h2>
  </div>

  ${subjectSections}

  ${subjectSections.length === 0 ? '<p style="text-align:center;color:#94a3b8;padding:30px 0;font-size:11px;">この期間の記録はありません</p>' : ''}

  <!-- Footer -->
  <div class="report-footer">
    <span>東進育英舎 — ${generatedDate} 出力</span>
    <span style="font-size:7px;color:#cbd5e1;letter-spacing:0.1em;">CONFIDENTIAL</span>
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
