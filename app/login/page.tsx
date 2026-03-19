"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BookOpen, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      setError("リセットメールの送信に失敗しました");
      setLoading(false);
      return;
    }

    setResetSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary/5 via-surface to-secondary/5 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4">
            <BookOpen size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Lesson Track
          </h1>
          <p className="text-text-muted text-sm mt-1">個別指導 学習管理</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          {resetSent ? (
            <div className="text-center py-4">
              <p className="text-success font-medium mb-2">
                リセットメールを送信しました
              </p>
              <p className="text-text-muted text-sm">
                メールに記載のリンクからパスワードを再設定してください
              </p>
              <button
                onClick={() => {
                  setResetMode(false);
                  setResetSent(false);
                }}
                className="mt-4 text-primary text-sm font-medium hover:underline"
              >
                ログインに戻る
              </button>
            </div>
          ) : (
            <form onSubmit={resetMode ? handleResetPassword : handleLogin}>
              <h2 className="text-lg font-semibold mb-6">
                {resetMode ? "パスワードリセット" : "ログイン"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-text mb-1.5"
                  >
                    メールアドレス
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                             placeholder:text-text-muted/50 focus:outline-none focus:ring-2
                             focus:ring-primary/20 focus:border-primary transition-colors"
                    placeholder="example@email.com"
                  />
                </div>

                {!resetMode && (
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-text mb-1.5"
                    >
                      パスワード
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-white text-text
                                 placeholder:text-text-muted/50 focus:outline-none focus:ring-2
                                 focus:ring-primary/20 focus:border-primary transition-colors pr-10"
                        placeholder="パスワードを入力"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted
                                 hover:text-text transition-colors"
                        aria-label={
                          showPassword
                            ? "パスワードを隠す"
                            : "パスワードを表示"
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-danger text-sm bg-danger-light rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-primary text-white font-medium
                           hover:bg-primary-dark active:scale-[0.98] transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {resetMode ? "リセットメールを送信" : "ログイン"}
                </button>
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(!resetMode);
                    setError("");
                  }}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  {resetMode
                    ? "ログインに戻る"
                    : "パスワードを忘れた方"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
