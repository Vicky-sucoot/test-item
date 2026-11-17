import { db } from "@/lib/db";
import { PERMISSION, PERMISSION_LABEL, SOURCE_TYPE_LABEL, YES_NO_UNKNOWN_LABEL, type SourceType } from "@/lib/constants";
import { Badge, SourceBadge } from "@/components/Badges";
import { paperTitle } from "@/components/QuestionView";
import { savePaperAction, saveSourceCheckAction } from "../actions";

interface Check {
  id: number;
  issuer: string;
  announcement_url: string | null;
  papers_public: string;
  answers_public: string;
  copyright_note: string | null;
  reuse_permission: string;
  confirm_method: string | null;
  checked_on: string | null;
  checked_by: string | null;
  note: string | null;
}

interface Paper {
  id: number;
  source_type: SourceType;
  bank: string | null;
  year: number | null;
  exam_name: string;
  position: string | null;
  subject_label: string | null;
  exam_date: string | null;
  paper_url: string | null;
  answer_url: string | null;
  announcement_url: string | null;
  note: string | null;
  n: number;
}

function YN({ name, value, id }: { name: string; value: string; id: string }) {
  return (
    <select id={id} name={name} className="input" defaultValue={value}>
      {Object.entries(YES_NO_UNKNOWN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

function CheckForm({ c }: { c?: Check }) {
  const p = `c${c?.id ?? "new"}`;
  return (
    <form action={saveSourceCheckAction} className="grid gap-2 md:grid-cols-4">
      {c ? <input type="hidden" name="id" value={c.id} /> : (
        <div className="md:col-span-4">
          <label className="label" htmlFor={`${p}-issuer`}>發布單位</label>
          <input id={`${p}-issuer`} name="issuer" className="input" required />
        </div>
      )}
      <div className="md:col-span-2">
        <label className="label" htmlFor={`${p}-url`}>公告頁網址</label>
        <input id={`${p}-url`} name="announcement_url" type="url" className="input" defaultValue={c?.announcement_url ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`${p}-pp`}>試題是否公開</label>
        <YN id={`${p}-pp`} name="papers_public" value={c?.papers_public ?? "UNKNOWN"} />
      </div>
      <div>
        <label className="label" htmlFor={`${p}-ap`}>答案是否公開</label>
        <YN id={`${p}-ap`} name="answers_public" value={c?.answers_public ?? "UNKNOWN"} />
      </div>
      <div className="md:col-span-4">
        <label className="label" htmlFor={`${p}-cn`}>著作權或使用聲明（原文摘錄＋出處）</label>
        <textarea id={`${p}-cn`} name="copyright_note" className="input min-h-14" defaultValue={c?.copyright_note ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`${p}-perm`}>可否在產品內重製</label>
        <select id={`${p}-perm`} name="reuse_permission" className="input" defaultValue={c?.reuse_permission ?? "UNKNOWN"}>
          {PERMISSION.map((k) => <option key={k} value={k}>{PERMISSION_LABEL[k]}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${p}-cm`}>確認方式</label>
        <input id={`${p}-cm`} name="confirm_method" className="input" placeholder="網站聲明／書面同意／法律意見" defaultValue={c?.confirm_method ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`${p}-on`}>檢查日期</label>
        <input id={`${p}-on`} name="checked_on" type="date" className="input" defaultValue={c?.checked_on ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor={`${p}-by`}>檢查人</label>
        <input id={`${p}-by`} name="checked_by" className="input" defaultValue={c?.checked_by ?? ""} />
      </div>
      <div className="md:col-span-3">
        <label className="label" htmlFor={`${p}-note`}>備註</label>
        <input id={`${p}-note`} name="note" className="input" defaultValue={c?.note ?? ""} />
      </div>
      <div className="flex items-end">
        <button className="btn btn-primary w-full">儲存</button>
      </div>
    </form>
  );
}

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ saved?: string; err?: string }> }) {
  const sp = await searchParams;
  const checks = db().prepare("SELECT * FROM source_checks ORDER BY id").all() as Check[];
  const papers = db()
    .prepare("SELECT p.*, (SELECT COUNT(*) FROM questions q WHERE q.paper_id=p.id) n FROM exam_papers p ORDER BY p.year DESC NULLS LAST, p.id DESC")
    .all() as Paper[];
  const permTone = (p: string) => (p === "ALLOWED" ? "green" : p === "NOT_ALLOWED" ? "red" : "amber") as "green" | "red" | "amber";

  return (
    <div className="space-y-4">
      <h1 className="h1">來源使用條件與試卷</h1>
      {sp.saved && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-900">已儲存。</p>}
      {sp.err && <p className="rounded bg-red-50 p-2 text-sm text-red-800">{sp.err}</p>}
      <p className="text-sm muted">
        是否向銀行或台灣金融研訓院確認使用條件由你決定；此表用來記錄檢查結果。目前題庫僅供個人本機使用，不公開發布。
      </p>

      <section className="space-y-3">
        <h2 className="h2">來源使用條件檢查表</h2>
        {checks.map((c) => (
          <details key={c.id} className="card">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-semibold">{c.issuer}</span>
              <Badge tone={permTone(c.reuse_permission)}>{PERMISSION_LABEL[c.reuse_permission as keyof typeof PERMISSION_LABEL]}</Badge>
              <span className="text-xs muted">
                試題公開：{YES_NO_UNKNOWN_LABEL[c.papers_public]}・答案公開：{YES_NO_UNKNOWN_LABEL[c.answers_public]}
                {c.checked_on ? `・檢查日 ${c.checked_on}` : "・尚未檢查"}
              </span>
            </summary>
            <div className="mt-3"><CheckForm c={c} /></div>
          </details>
        ))}
        <details className="card">
          <summary className="cursor-pointer font-semibold">＋ 新增發布單位</summary>
          <div className="mt-3"><CheckForm /></div>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="h2">試卷</h2>
        {papers.map((p) => (
          <details key={p.id} id={`paper-${p.id}`} className="card">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <SourceBadge type={p.source_type} />
              <span className="font-semibold">{paperTitle(p)}</span>
              <span className="text-xs muted">{p.subject_label ?? ""}・{p.n} 題</span>
              {p.source_type !== "DEMO" && !p.paper_url && <Badge tone="red">缺少原卷網址</Badge>}
              {p.source_type !== "DEMO" && !p.answer_url && <Badge tone="amber">缺少答案網址</Badge>}
            </summary>
            <form action={savePaperAction} className="mt-3 grid gap-2 md:grid-cols-4">
              <input type="hidden" name="id" value={p.id} />
              <p className="text-xs muted md:col-span-4">來源類型：{SOURCE_TYPE_LABEL[p.source_type]}（不可在此變更）</p>
              {([
                ["bank", "銀行", p.bank],
                ["year", "年度", p.year],
                ["exam_name", "甄試名稱", p.exam_name],
                ["position", "職缺／類別", p.position],
                ["subject_label", "原卷科目", p.subject_label],
                ["exam_date", "考試日期", p.exam_date],
                ["paper_url", "原始試卷網址", p.paper_url],
                ["answer_url", "官方答案網址", p.answer_url],
                ["announcement_url", "甄試公告網址", p.announcement_url],
                ["note", "備註", p.note],
              ] as const).map(([k, l, v]) => (
                <div key={k} className={k.endsWith("url") || k === "note" ? "md:col-span-2" : ""}>
                  <label className="label" htmlFor={`p${p.id}-${k}`}>{l}</label>
                  <input id={`p${p.id}-${k}`} name={k} className="input" defaultValue={v ?? ""} />
                </div>
              ))}
              <div className="flex items-end md:col-span-4">
                <button className="btn btn-primary">儲存試卷資料</button>
              </div>
            </form>
          </details>
        ))}
      </section>
    </div>
  );
}
