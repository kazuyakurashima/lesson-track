import { createClient } from "@/lib/supabase/server";

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

      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold">アカウント情報</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">名前</span>
            <span className="font-medium">{profile?.display_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">メール</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">権限</span>
            <span className="font-medium">
              {profile?.role === "admin" ? "管理者" : "講師"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold mb-2">バージョン</h2>
        <p className="text-sm text-text-muted">東進育英舎 単元別強化講座 v0.1.0</p>
      </div>
    </div>
  );
}
