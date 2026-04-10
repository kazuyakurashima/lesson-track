import { createClient } from "@/lib/supabase/server";
import {
  BookOpen,
  Camera,
  FileText,
  History,
  HelpCircle,
  PenSquare,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── コンテンツ定義 ──────────────────────────────────────────────

const CHANGELOG: {
  version: string;
  date: string;
  isLatest?: boolean;
  items: string[];
}[] = [
  {
    version: "0.2.0",
    date: "2026-04-10",
    isLatest: true,
    items: [
      "授業記録の編集機能を追加（日付・ステップ・単元・点数・コメント）",
      "授業記録の削除機能を追加（答案画像も合わせて削除）",
      "編集・削除は入力者本人または管理者のみ操作可能",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-03-18",
    items: [
      "初期リリース",
      "生徒管理（登録・編集・科目・コンテンツグループ選択）",
      "授業記録登録（写真撮影 + AI 自動解析）",
      "単元別進捗表示・カレンダー・学習ペース",
      "保護者レポート出力",
    ],
  },
];

const HOW_TO_USE: {
  icon: React.ElementType;
  title: string;
  steps: string[];
}[] = [
  {
    icon: Camera,
    title: "授業を記録する",
    steps: [
      "下部ナビ「記録」をタップ",
      "生徒を選択し、答案を撮影",
      "AI が点数・単元を自動読み取り — 必要なら修正して保存",
      "写真なしの場合は「手動入力」に切り替え",
    ],
  },
  {
    icon: PenSquare,
    title: "記録を編集・削除する",
    steps: [
      "生徒一覧から対象の生徒をタップ",
      "カレンダーで対象日を選択",
      "各記録の右端「⋮」ボタンから編集または削除",
    ],
  },
  {
    icon: UserPlus,
    title: "生徒を追加する",
    steps: [
      "「生徒一覧」右上の「追加」ボタンをタップ（管理者のみ）",
      "氏名・学年・受講タイプ・科目を入力して登録",
    ],
  },
  {
    icon: FileText,
    title: "保護者レポートを出力する",
    steps: [
      "生徒詳細ページ右上の「レポート」をタップ",
      "期間を選択してレポートを生成 → 印刷または PDF 保存",
    ],
  },
];

// ─── ページ ──────────────────────────────────────────────────────

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = (await supabase
    .from("users")
    .select("display_name, role")
    .eq("id", user!.id)
    .single()) as { data: { display_name: string; role: string } | null };

  const initial = (profile?.display_name ?? user?.email ?? "?").charAt(0).toUpperCase();
  const isAdmin = profile?.role === "admin";
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "—";

  return (
    <div className="space-y-5 pb-4">

      {/* ── アカウントヒーロー ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* グラデーションバナー */}
        <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="px-5 pb-5">
          {/* アバター（バナーにオーバーラップ） */}
          <div className="-mt-8 mb-3">
            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg ring-4 ring-card">
              <span className="text-2xl font-bold text-primary-foreground">{initial}</span>
            </div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight truncate">
                {profile?.display_name ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{user?.email}</p>
            </div>
            <Badge
              variant={isAdmin ? "default" : "secondary"}
              className="shrink-0 mt-1"
            >
              {isAdmin ? "管理者" : "講師"}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── 使い方 ── */}
      <section>
        <SectionHeader icon={BookOpen} title="使い方" />
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {HOW_TO_USE.map(({ icon: Icon, title, steps }) => (
            <div key={title} className="px-5 py-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm font-semibold">{title}</p>
              </div>
              <ol className="space-y-1.5 pl-1">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="shrink-0 w-4 text-right tabular-nums text-xs text-muted-foreground/40 mt-px">
                      {i + 1}.
                    </span>
                    <span className="leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* ── 更新履歴 ── */}
      <section>
        <SectionHeader icon={History} title="更新履歴" />
        <div className="bg-card rounded-2xl border border-border divide-y divide-border">
          {CHANGELOG.map(({ version: v, date, isLatest, items }) => (
            <div key={v} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`
                  inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold tabular-nums
                  ${isLatest
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"}
                `}>
                  v{v}
                </span>
                {isLatest && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                    <Sparkles className="h-3 w-3" />
                    最新
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{date}</span>
              </div>
              <ul className="space-y-1.5">
                {items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="shrink-0 text-primary/50 mt-1.5 h-1 w-1 rounded-full bg-current" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── お困りの場合 ── */}
      <section>
        <SectionHeader icon={HelpCircle} title="お困りの場合" />
        <div className="bg-card rounded-2xl border border-border px-5 py-4 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            操作方法の疑問点や不具合は、管理者（倉島）までご連絡ください。
          </p>
        </div>
      </section>

      {/* ── バージョンフッター ── */}
      <Separator />
      <p className="text-xs text-muted-foreground/50 text-center tracking-wide">
        東進育英舎 単元別強化講座 &nbsp;·&nbsp; v{version}
      </p>
    </div>
  );
}

// ─── 共通見出しコンポーネント ─────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
        {title}
      </h2>
    </div>
  );
}
