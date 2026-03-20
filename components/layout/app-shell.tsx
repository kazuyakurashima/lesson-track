"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  PenSquare,
  Users,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import Image from "next/image";
import type { UserRole } from "@/lib/types/supabase";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-background">
      {/* ==================== Mobile Header ==================== */}
      <header className="md:hidden flex items-center justify-between px-4 h-14 bg-card/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-30">
        <Sheet>
          <SheetTrigger className="p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            <Menu className="h-5 w-5" />
            <span className="sr-only">メニューを開く</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="px-5 py-4 border-b border-border/50">
              <SheetTitle className="flex items-center gap-2.5 text-left">
                <Image src="/icon.png" alt="Lesson Track" width={32} height={32} className="rounded-lg shadow-sm" />
                <span className="font-bold tracking-tight">Lesson Track</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="px-3 py-4 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150
                    ${
                      isActive(href)
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
            </nav>
            <Separator />
            <div className="px-3 py-3">
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {user.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                    {user.role === "admin" ? "管理者" : "講師"}
                  </Badge>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <Image src="/icon.png" alt="Lesson Track" width={24} height={24} className="rounded" />
          <span className="font-bold text-sm tracking-tight">Lesson Track</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 -mr-1 rounded-full outline-none"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {user.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-popover rounded-lg shadow-md border border-border p-1">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ==================== Desktop Sidebar ==================== */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:sticky md:top-0 md:h-dvh bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border">
          <Image src="/icon.png" alt="Lesson Track" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-sm tracking-tight text-sidebar-foreground">Lesson Track</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-150
                ${
                  isActive(href)
                    ? "bg-sidebar-accent text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }
              `}
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border relative">
          <button
            onClick={() => setSidebarMenuOpen(!sidebarMenuOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-all duration-150 outline-none"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-semibold">
                {user.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">{user.displayName}</p>
              <p className="text-[11px] text-sidebar-foreground/50">
                {user.role === "admin" ? "管理者" : "講師"}
              </p>
            </div>
          </button>
          {sidebarMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSidebarMenuOpen(false)} />
              <div className="absolute left-3 bottom-full mb-1 z-50 w-56 bg-popover rounded-lg shadow-md border border-border p-1">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => { setSidebarMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ==================== Main Content ==================== */}
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>

      {/* ==================== Mobile Bottom Nav ==================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/80 backdrop-blur-lg border-t border-border/50">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`
                flex flex-col items-center justify-center gap-0.5 py-1 min-w-[64px]
                transition-all duration-150
                ${
                  isActive(href)
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                }
              `}
            >
              <div className={`px-4 py-1 rounded-full transition-all duration-200 ${
                isActive(href) ? "bg-primary/10" : ""
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-[10px] transition-all duration-150 ${
                isActive(href) ? "font-semibold" : "font-medium"
              }`}>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
