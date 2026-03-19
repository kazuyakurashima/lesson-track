"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  PenSquare,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import type { UserRole } from "@/lib/types/supabase";

interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/record", label: "記録", icon: PenSquare },
  { href: "/students", label: "生徒", icon: Users },
  { href: "/settings", label: "設定", icon: Settings },
];

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-card border-b border-border sticky top-0 z-30">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-text-muted hover:text-text transition-colors"
          aria-label="メニューを開く"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-primary" />
          <span className="font-semibold text-sm">Lesson Track</span>
        </div>
        <div className="w-9" /> {/* Spacer for centering */}
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50 h-dvh w-64
          bg-card border-r border-border
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:flex md:flex-col
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="font-bold text-base">Lesson Track</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 text-text-muted hover:text-text"
            aria-label="メニューを閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-colors
                ${
                  isActive(href)
                    ? "bg-primary/10 text-primary"
                    : "text-text-muted hover:bg-surface hover:text-text"
                }
              `}
            >
              <Icon size={20} />
              {label}
            </a>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-border">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                {user.displayName.charAt(0)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.displayName}
                </p>
                <p className="text-xs text-text-muted">
                  {user.role === "admin" ? "管理者" : "講師"}
                </p>
              </div>
              <ChevronDown
                size={16}
                className={`text-text-muted transition-transform ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-card rounded-lg shadow-md border border-border overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors"
                >
                  <LogOut size={16} />
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className={`
                flex flex-col items-center justify-center gap-1 py-1 px-3 min-w-[64px]
                ${
                  isActive(href)
                    ? "text-primary"
                    : "text-text-muted"
                }
              `}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
