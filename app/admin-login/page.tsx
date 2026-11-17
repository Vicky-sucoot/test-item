import { redirect } from "next/navigation";
import { adminConfigured, checkPassword, isAdmin, setAdminCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function login(fd: FormData) {
  "use server";
  if (!checkPassword(String(fd.get("password") ?? ""))) redirect("/admin-login?error=1");
  await setAdminCookie();
  redirect("/admin");
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm card space-y-3">
      <h1 className="h1">管理頁登入</h1>
      {!adminConfigured() ? (
        <div className="space-y-2 text-sm">
          <p className="text-red-700">尚未設定管理密碼。</p>
          <p>請在專案根目錄建立 <code>.env.local</code>，內容：</p>
          <pre className="rounded bg-slate-100 p-2 text-xs">ADMIN_PASSWORD=你的密碼</pre>
          <p>然後重新啟動 <code>npm run dev</code>。</p>
        </div>
      ) : (
        <form action={login} className="space-y-3">
          {error && <p className="text-sm text-red-700">密碼錯誤。</p>}
          <div>
            <label className="label" htmlFor="password">管理密碼</label>
            <input id="password" name="password" type="password" className="input" autoFocus required />
          </div>
          <button className="btn btn-primary w-full">登入</button>
        </form>
      )}
    </div>
  );
}
