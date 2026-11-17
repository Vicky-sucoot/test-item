import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { getJob, getJobItems, uploadsDir } from "@/lib/import/service";
import { getTopics } from "@/lib/questions";
import { SOURCE_TYPE_LABEL, type SourceType } from "@/lib/constants";
import type { PaperMeta } from "@/lib/import/csv";
import { QuestionFields } from "@/components/QuestionFields";
import { Badge } from "@/components/Badges";
import { paperTitle } from "@/components/QuestionView";
import {
  addItemAction,
  applyAnswersAction,
  deleteItemAction,
  deleteJobAction,
  publishJobAction,
  saveItemAction,
} from "../../actions";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string; saved?: string; filter?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const job = getJob(id);
  if (!job) notFound();
  const all = getJobItems(id);
  const topics = getTopics();
  const filter = sp.filter ?? "pending";
  const items = all.filter((i) =>
    filter === "pending" ? !i.published_question_id : filter === "warn" ? !i.published_question_id && JSON.parse(i.warnings || "[]").length : true,
  );
  const jobWarnings: string[] = JSON.parse(job.warnings || "[]");
  const paper = job.paper_meta ? (JSON.parse(job.paper_meta) as PaperMeta) : null;
  const hasPdf = fs.existsSync(path.join(uploadsDir(), `job-${id}-paper.pdf`));
  const hasAnsPdf = fs.existsSync(path.join(uploadsDir(), `job-${id}-answer.pdf`));
  const verified = all.filter((i) => i.verified && !i.published_question_id).length;
  const published = all.filter((i) => i.published_question_id).length;

  return (
    <div className="space-y-4">
      <Link className="link text-sm" href="/admin/import">← 匯入列表</Link>
      <section className="card space-y-2">
        <h1 className="h1">匯入檢查 #{id}</h1>
        <p className="text-sm">
          {job.kind}・{job.file_name}・{job.created_at}
        </p>
        {paper && (
          <p className="text-sm">
            {SOURCE_TYPE_LABEL[paper.source_type as SourceType]}：{paperTitle(paper)}
            {paper.subject_label ? `（${paper.subject_label}）` : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          {hasPdf && <a className="link" href={`/admin/files/job-${id}-paper.pdf`} target="_blank">開啟原卷 PDF</a>}
          {hasAnsPdf && <a className="link" href={`/admin/files/job-${id}-answer.pdf`} target="_blank">開啟答案 PDF</a>}
          {paper?.paper_url && <a className="link" href={paper.paper_url} target="_blank" rel="noreferrer">原始試卷網址</a>}
        </div>
        {jobWarnings.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-amber-900">
            {jobWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        {sp.msg && <p className="rounded bg-sky-50 p-2 text-sm text-sky-900">{sp.msg}</p>}
        {sp.err && <p className="rounded bg-red-50 p-2 text-sm text-red-800">第 {sp.saved} 筆未標記核對：{sp.err}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-sm">共 {all.length} 筆・已核對待發布 {verified}・已發布 {published}</span>
          <form action={publishJobAction} className="ml-auto">
            <input type="hidden" name="job_id" value={id} />
            <button className="btn btn-primary" disabled={!verified}>發布已核對的 {verified} 題</button>
          </form>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">貼上官方答案（依題號套用）</h2>
        <form action={applyAnswersAction} className="flex flex-col gap-2 md:flex-row">
          <input type="hidden" name="job_id" value={id} />
          <textarea name="answer_text" className="input min-h-14 flex-1" placeholder={"支援：1.C 2.A …／題號與答案兩行表格／CADB… 連續字母"} />
          <button className="btn btn-outline">套用答案</button>
        </form>
      </section>

      {job.raw_text && job.kind === "PDF" && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">PDF 擷取原文（供比對）</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{job.raw_text}</pre>
          {job.answer_raw_text && (
            <>
              <p className="mt-2 font-semibold">答案原文</p>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{job.answer_raw_text}</pre>
            </>
          )}
        </details>
      )}

      <nav className="flex flex-wrap gap-2">
        {[
          ["pending", "未發布"],
          ["warn", "有警示"],
          ["all", "全部"],
        ].map(([k, l]) => (
          <Link key={k} href={`?filter=${k}`} className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-outline"}`}>{l}</Link>
        ))}
      </nav>

      {items.map((it) => {
        const warnings: string[] = JSON.parse(it.warnings || "[]");
        const done = !!it.published_question_id;
        return (
          <section key={it.id} id={`item-${it.id}`} className={`card space-y-3 ${it.verified && !done ? "border-emerald-300" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">第 {it.seq} 筆</span>
              {done ? (
                <Link href={`/admin/questions/${it.published_question_id}`}><Badge tone="green">已發布 #{it.published_question_id}</Badge></Link>
              ) : it.verified ? (
                <Badge tone="green">已核對，待發布</Badge>
              ) : (
                <Badge tone="amber">待核對</Badge>
              )}
              {String(sp.saved) === String(it.id) && !sp.err && <Badge tone="blue">已儲存</Badge>}
              {warnings.map((w, i) => <Badge key={i} tone="red">{w}</Badge>)}
            </div>
            {it.raw && job.kind === "PDF" && (
              <details className="text-xs">
                <summary className="cursor-pointer muted">此題擷取原文</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2">{it.raw}</pre>
              </details>
            )}
            {done ? (
              <p className="text-sm">{it.stem}</p>
            ) : (
              <>
                <form action={saveItemAction} className="space-y-3">
                  <input type="hidden" name="id" value={it.id} />
                  <input type="hidden" name="job_id" value={id} />
                  <QuestionFields v={it} topics={topics} idPrefix={`i${it.id}`} />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                      <input type="checkbox" name="verified" value="1" defaultChecked={!!it.verified} />
                      已與原卷（及官方答案）逐字核對
                    </label>
                    <button className="btn btn-primary btn-sm ml-auto">儲存</button>
                  </div>
                </form>
                <form action={deleteItemAction}>
                  <input type="hidden" name="id" value={it.id} />
                  <input type="hidden" name="job_id" value={id} />
                  <button className="btn btn-danger btn-sm">刪除此筆（誤切）</button>
                </form>
              </>
            )}
          </section>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <form action={addItemAction}>
          <input type="hidden" name="job_id" value={id} />
          <button className="btn btn-outline">＋ 新增一筆（補漏題）</button>
        </form>
        <form action={deleteJobAction} className="ml-auto">
          <input type="hidden" name="job_id" value={id} />
          <button className="btn btn-danger">刪除此匯入工作（已發布題目保留）</button>
        </form>
      </div>
    </div>
  );
}
