"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });

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
    <div className="min-h-dvh flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/3" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/icon.png"
            alt="Lesson Track"
            width={64}
            height={64}
            className="mx-auto mb-4 rounded-2xl shadow-lg shadow-primary/25"
          />
          <h1 className="text-2xl font-bold tracking-tight">Lesson Track</h1>
          <p className="text-muted-foreground text-sm mt-1">個別指導 学習管理</p>
        </div>

        {/* Card */}
        <Card className="shadow-xl shadow-black/5 border-border/50">
          <CardHeader className="pb-0">
            <h2 className="text-lg font-semibold tracking-tight">
              {resetMode ? "パスワードリセット" : "ログイン"}
            </h2>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-medium mb-1">リセットメールを送信しました</p>
                <p className="text-muted-foreground text-sm">
                  メールに記載のリンクからパスワードを再設定してください
                </p>
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => { setResetMode(false); setResetSent(false); }}
                >
                  ログインに戻る
                </Button>
              </div>
            ) : (
              <form onSubmit={resetMode ? handleResetPassword : handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    メールアドレス
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="example@email.com"
                  />
                </div>

                {!resetMode && (
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">
                      パスワード
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="パスワードを入力"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5 font-medium">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {resetMode ? "リセットメールを送信" : "ログイン"}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm"
                    onClick={() => { setResetMode(!resetMode); setError(""); }}
                  >
                    {resetMode ? "ログインに戻る" : "パスワードを忘れた方"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Lesson Track v0.1.0
        </p>
      </div>
    </div>
  );
}
