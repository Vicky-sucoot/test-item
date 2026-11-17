import Link from "next/link";
import { adminCounts } from "@/lib/stats";
import { listJobs } from "@/lib/import/service";

export default function AdminHome() {
  const c = adminCounts();
  const jobs = listJobs().slice(0, 8);
  const cards: [string, number, string][] = [
    ["已發布題目", c.published, "/admin/questions"],
    ["資料未核對／不符", c.unverified, "/admin/questions?flag=unverified"],
    ["解析待審核", c.explanationPending, "/admin/questions?flag=explanation"],
    ["待人工分類", c.unclassified, "/admin/questions?subject=UNCLASSIFIED"],
    ["缺少官方答案", c.missingAnswer, "/admin/questions?flag=missing"],
    ["法規待核對", c.lawRecheck, "/admin/questions?flag=law"],
    ["缺少原卷網址", c.missingSource, "/admin/questions?flag=nosource"],
    ["匯入待發布", c.pendingImports, "/admin/import"],
  ];
  return (
    <div className="space-y-4">
      <h1 className="h1">管理總覽</h1>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        題庫目前僅供你個人在本機使用，不公開發布。匯入真題前，請在「來源與試卷」記錄各來源的使用條件與核對狀態。
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, n, href]) => (
          <Link key={label} href={href} className="card hover:bg-slate-50">
            <div className="text-2xl font-bold">{n}</div>
            <div className="text-sm muted">{label}</div>
          </Link>
        ))}
      </div>
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="h2">最近匯入</h2>
          <Link className="btn btn-primary btn-sm" href="/admin/import">新增匯入</Link>
        </div>
        {jobs.length ? (
          <ul className="space-y-1 text-sm">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link className="link" href={`/admin/import/${j.id}`}>
                  #{j.id} {j.kind} {j.file_name}
                </Link>{" "}
                <span className="muted">
                  {j.created_at}・共 {j.total} 題・已核對 {j.verified}・已發布 {j.published}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm muted">尚無匯入紀錄。</p>
        )}
      </section>
    </div>
  );
}
