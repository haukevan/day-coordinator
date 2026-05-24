import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--panel)" }}>
        <h1 className="text-xl font-bold mb-1">Dashboard</h1>
        <p className="text-sm text-gray-400 mb-4">Signed in as {user.email ?? user.phone}</p>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="text-sm px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
