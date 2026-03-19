import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import type { UserRole } from "@/lib/types/supabase";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, role")
    .eq("id", user.id)
    .single() as { data: { display_name: string; role: UserRole } | null };

  return (
    <AppShell
      user={{
        id: user.id,
        email: user.email ?? "",
        displayName: profile?.display_name ?? user.email ?? "",
        role: profile?.role ?? "instructor",
      }}
    >
      {children}
    </AppShell>
  );
}
