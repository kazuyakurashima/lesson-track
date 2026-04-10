import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";

const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: "0.2.0",
    date: "2026-04-10",
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

const HOW_TO_USE = [
  {
    title: "授業を記録する",
    steps: [
      "下のナビゲーションバーから「記録」をタップ",
      "生徒を選択し、答案を撮影する",
      "AI が点数・単元を自動読み取り — 必要なら修正して保存",
      "写真なしで入力したい場合は「手動入力」に切り替え",
    ],
  },
  {
    title: "記録を編集・削除する",
    steps: [
      "生徒一覧から対象の生徒をタップ",
      "カレンダーで日付を選択すると記録が表示される",
      "各記録の右端「⋮」ボタンから編集または削除",
    ],
  },
  {
    title: "生徒を追加する（管理者のみ）",
    steps: [
      "「生徒一覧」右上の「追加」ボタンをタップ",
      "氏名・学年・受講タイプ・科目を入力して登録",
    ],
  },
  {
    title: "保護者レポートを出力する",
    steps: [
      "生徒詳細ページ右上の「レポート」ボタンをタップ",
      "期間を選択してレポートを生成、印刷またはPDF保存",
    ],
  },
];

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">設定</h1>

      {/* アカウント情報 */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold">アカウント情報</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">名前</span>
            <span className="font-medium">{profile?.display_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">メール</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">権限</span>
            <span className="font-medium">
              {profile?.role === "admin" ? "管理者" : "講師"}
            </span>
          </div>
        </div>
      </div>

      {/* 使い方 */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold">使い方</h2>
        <div className="space-y-5">
          {HOW_TO_USE.map((section) => (
            <div key={section.title}>
              <p className="text-sm font-medium mb-2">{section.title}</p>
              <ol className="space-y-1">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0 tabular-nums text-muted-foreground/50">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* 更新履歴 */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold">更新履歴</h2>
        <div className="space-y-5">
          {CHANGELOG.map((release, i) => (
            <div key={release.version}>
              {i > 0 && <Separator className="mb-5" />}
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-sm font-semibold">v{release.version}</span>
                <span className="text-xs text-muted-foreground">{release.date}</span>
              </div>
              <ul className="space-y-1">
                {release.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0 text-muted-foreground/40">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* お困りの場合 */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-2">
        <h2 className="font-semibold">お困りの場合</h2>
        <p className="text-sm text-muted-foreground">
          不具合や操作の疑問点は管理者にお問い合わせください。
        </p>
      </div>

      {/* バージョン */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        東進育英舎 単元別強化講座 v{process.env.npm_package_version}
      </p>
    </div>
  );
}
