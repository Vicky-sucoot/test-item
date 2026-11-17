import Link from "next/link";
import { notFound } from "next/navigation";
import { db, today } from "@/lib/db";
import { getCitations, getDuplicates, getQuestion, getTopics } from "@/lib/questions";
import { EXPLANATION_STATUS, EXPLANATION_STATUS_LABEL, VERIFY_STATUS, VERIFY_STATUS_LABEL } from "@/lib/constants";
import { formatAnswer } from "@/lib/answer";
import { QuestionFields } from "@/components/QuestionFields";
import { Badge, SourceBadge } from "@/components/Badges";
import { QuestionHeader, paperTitle } from "@/components/QuestionView";
import {
  addCitationAction,
  confirmDuplicateAction,
  deleteCitationAction,
  markDuplicateAction,
  redetectDuplicateAction,
  saveQuestionAction,
  unlinkDuplicateAction,
} from "../../actions";

export default async function EditQuestion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; err?: string; msg?: string }>;
}) {
  const q = getQuestion(Number((await params).id));
  if (!q) notFound();
  const sp = await searchParams;
  const topics = getTopics();
  const cites = getCitations([q.id]).get(q.id) ?? [];
  const dups = getDuplicates(q);
  const group = q.duplicate_group_id
    ? (db().prepare("SELECT * FROM duplicate_groups WHERE id=?").get(q.duplicate_group_id) as { detect_method: string; confirmed: number })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <Link className="link" href="/admin/questions">← 題目管理</Link>
        <Link className="link" href={`/q/${q.id}?show=1`}>前台檢視</Link>
      </div>
      <section className="card space-y-2">
        <h1 className="h1">編輯題目 #{q.id}</h1>
        <QuestionHeader q={q} />
        <p className="text-xs muted">
          試卷：{paperTitle(q)}・原卷網址：{q.paper_url ?? (q.source_type === "DEMO" ? "不適用" : "缺少")}（試卷資料請到「來源與試卷」修改）
        </p>
        {sp.saved && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-900">已儲存。</p>}
        {sp.msg && <p className="rounded bg-sky-50 p-2 text-sm text-sky-900">{sp.msg}</p>}
        {sp.err && <p className="rounded bg-red-50 p-2 text-sm text-red-800">{sp.err}</p>}
      </section>

      <form action={saveQuestionAction} className="card space-y-4">
        <input type="hidden" name="id" value={q.id} />
        <QuestionFields v={q} topics={topics} idPrefix="q" />
        <div className="grid gap-2 md:grid-cols-4">
          <div>
            <label className="label" htmlFor="verify_status">資料核對狀態</label>
            <select id="verify_status" name="verify_status" className="input" defaultValue={q.verify_status}>
              {VERIFY_STATUS.map((s) => <option key={s} value={s}>{VERIFY_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="explanation_status">解析審核狀態</label>
            <select id="explanation_status" name="explanation_status" className="input" defaultValue={q.explanation_status}>
              {EXPLANATION_STATUS.map((s) => <option key={s} value={s}>{EXPLANATION_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="law_recheck_date">目前法規核對日期</label>
            <input id="law_recheck_date" name="law_recheck_date" type="date" className="input" defaultValue={q.law_recheck_date ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="status">上架狀態</label>
            <select id="status" name="status" className="input" defaultValue={q.status}>
              <option value="PUBLISHED">已發布（本機題庫）</option>
              <option value="ARCHIVED">下架</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="explanation_reviewed_now" value="1" />
          我已審核目前的解析內容（標記為「已審核」）
        </label>
        <p className="text-xs muted">
          修改解析內容但未勾選上方選項時，解析狀態會自動退回「待審核」。驗證時，示範題不可標為官方答案；未填答案必須標示「缺少官方答案」。
        </p>
        <button className="btn btn-primary">儲存題目</button>
      </form>

      <section className="card space-y-3" id="law">
        <h2 className="h2">法條引用</h2>
        <p className="text-xs muted">只記錄法規名稱、條號與核對日期／來源；未填核對日期者在前台顯示「條文未核對」。</p>
        {cites.length ? (
          <ul className="space-y-1 text-sm">
            {cites.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span>{c.law_name} {c.article_no}{c.version_note ? `（${c.version_note}）` : ""}</span>
                {c.checked_on ? <Badge tone="green">核對 {c.checked_on}</Badge> : <Badge tone="red">條文未核對</Badge>}
                {c.checked_source_url && <a className="link text-xs" href={c.checked_source_url} target="_blank" rel="noreferrer">來源</a>}
                <form action={deleteCitationAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="question_id" value={q.id} />
                  <button className="btn btn-danger btn-sm">刪除</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm muted">尚無法條引用。</p>
        )}
        <form action={addCitationAction} className="grid gap-2 md:grid-cols-6">
          <input type="hidden" name="question_id" value={q.id} />
          <input name="law_name" className="input md:col-span-1" placeholder="法規名稱" aria-label="法規名稱" required />
          <input name="article_no" className="input md:col-span-1" placeholder="條號，例：第 1 條" aria-label="條號" required />
          <input name="version_note" className="input md:col-span-1" placeholder="版本（考試當時／現行）" aria-label="版本" />
          <input name="checked_on" type="date" className="input md:col-span-1" defaultValue={today()} aria-label="核對日期" />
          <input name="checked_source_url" type="url" className="input md:col-span-1" placeholder="核對來源網址" aria-label="核對來源網址" />
          <button className="btn btn-outline md:col-span-1">新增引用</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">重複題</h2>
        {dups.length ? (
          <>
            <p className="text-sm">
              {group?.detect_method === "MANUAL" ? "人工標記" : "系統偵測（題幹與選項文字相同）"}・
              {group?.confirmed ? "已確認" : "待確認"}
            </p>
            <ul className="space-y-1 text-sm">
              {dups.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-1.5">
                  <SourceBadge type={d.source_type} />
                  <Link className="link" href={`/admin/questions/${d.id}`}>#{d.id} {paperTitle(d)} 第 {d.number_in_paper ?? "?"} 題</Link>
                  <span className="text-xs muted">答案 {d.answer_status === "MISSING" ? "缺少" : formatAnswer(d.official_answer, d.option_style)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {!group?.confirmed && (
                <form action={confirmDuplicateAction}>
                  <input type="hidden" name="question_id" value={q.id} />
                  <button className="btn btn-outline btn-sm">確認為重複題</button>
                </form>
              )}
              <form action={unlinkDuplicateAction}>
                <input type="hidden" name="question_id" value={q.id} />
                <button className="btn btn-danger btn-sm">將本題移出重複群組</button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <form action={redetectDuplicateAction}>
              <input type="hidden" name="question_id" value={q.id} />
              <button className="btn btn-outline btn-sm">偵測文字相同的題目</button>
            </form>
          </div>
        )}
        <form action={markDuplicateAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="question_id" value={q.id} />
          <div>
            <label className="label" htmlFor="other_id">與題目編號標記為重複</label>
            <input id="other_id" name="other_id" className="input w-32" inputMode="numeric" placeholder="例：12" />
          </div>
          <button className="btn btn-outline">標記</button>
        </form>
      </section>
    </div>
  );
}
