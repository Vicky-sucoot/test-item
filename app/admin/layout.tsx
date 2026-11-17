import Link from "next/link";
import { requireAdmin, clearAdminCookie } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await clearAdminCookie();
  redirect("/");
}

const NAV = [
  { href: "/admin", label: "總覽" },
  { href: "/admin/import", label: "匯入" },
  { href: "/admin/questions", label: "題目管理" },
  { href: "/admin/topics", label: "主題章節" },
  { href: "/admin/exam-settings", label: "模擬考比例" },
  { href: "/admin/sources", label: "來源與試卷" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-slate-800 p-1.5 text-sm text-white">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1 hover:bg-slate-700">
            {n.label}
          </Link>
        ))}
        <form action={logout} className="ml-auto">
          <button className="rounded-md px-2.5 py-1 hover:bg-slate-700">登出</button>
        </form>
      </div>
      {children}
    </div>
  );
}
