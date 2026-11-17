import Link from "next/link";
import { db } from "@/lib/db";
import { QUESTION_SELECT, type QuestionRow } from "@/lib/questions";
import { ALL_SUBJECTS, SUBJECT_LABEL } from "@/lib/constants";
import { AnswerStatusBadge, Badge, ExplanationBadge, LawRecheckBadge, VerifyBadge } from "@/components/Badges";
import { QuestionHeader } from "@/components/QuestionView";

const FLAGS: Record<string, [string, string]> = {
  unverified: ["資料未核對／不符", "q.verify_status IN ('UNVERIFIED','MISMATCH')"],
  explanation: ["解析待審核", "q.explanation_status='PENDING'"],
  noexpl: ["尚無解析", "q.explanation_status='NONE'"],
  missing: ["缺少官方答案", "q.answer_status='MISSING'"],
  law: ["法規待核對", "q.subject IN ('NEGOTIABLE_INSTRUMENTS','BANKING_ACT') AND COALESCE(q.law_recheck,'UNKNOWN') IN ('UNKNOWN','NEEDS_RECHECK')"],
  nosource: ["缺少原卷網址", "p.source_type!='DEMO' AND (p.paper_url IS NULL OR p.paper_url='')"],
  autosubject: ["科目為系統建議", "q.subject_source='AUTO'"],
  dup: ["重複題", "q.duplicate_group_id IS NOT NULL"],
  archived: ["已下架", "q.status='ARCHIVED'"],
};

export default async function AdminQuestions({
  searchParams,
}: {
  searchParams: Promise<{ flag?: string; subject?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  if (sp.flag && FLAGS[sp.flag]) where.push(FLAGS[sp.flag][1]);
  else where.push("q.status='PUBLISHED'");
  if (sp.subject) (where.push("q.subject=?"), params.push(sp.subject));
  if (sp.q) (where.push("(q.stem LIKE ? OR q.id = ?)"), params.push(`%${sp.q}%`, Number(sp.q) || -1));
  const rows = db()
    .prepare(`${QUESTION_SELECT} WHERE ${where.join(" AND ")} ORDER BY q.id DESC LIMIT 200`)
    .all(...params) as QuestionRow[];

  return (
    <div className="space-y-4">
      <h1 className="h1">題目管理</h1>
      <form method="get" className="card flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="flag">狀態</label>
          <select id="flag" name="flag" className="input" defaultValue={sp.flag ?? ""}>
            <option value="">已發布（全部）</option>
            {Object.entries(FLAGS).map(([k, [l]]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="subject">科目</label>
          <select id="subject" name="subject" className="input" defaultValue={sp.subject ?? ""}>
            <option value="">全部</option>
            {ALL_SUBJECTS.map((s) => (
              <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="q">關鍵字或題目編號</label>
          <input id="q" name="q" className="input" defaultValue={sp.q ?? ""} />
        </div>
        <button className="btn btn-primary">查詢</button>
      </form>
      <p className="text-sm muted">共 {rows.length} 筆（最多顯示 200 筆）</p>
      {rows.map((q) => (
        <Link key={q.id} href={`/admin/questions/${q.id}`} className="card block space-y-2 hover:bg-slate-50">
          <div className="flex items-center gap-2 text-xs muted">#{q.id}</div>
          <QuestionHeader q={q} />
          <p className="line-clamp-2 text-sm">{q.stem}</p>
          <div className="flex flex-wrap gap-1.5">
            <AnswerStatusBadge status={q.answer_status} />
            <VerifyBadge status={q.verify_status} />
            <ExplanationBadge status={q.explanation_status} />
            {(q.subject === "NEGOTIABLE_INSTRUMENTS" || q.subject === "BANKING_ACT") && <LawRecheckBadge status={q.law_recheck} />}
            {q.subject_source === "AUTO" && <Badge tone="amber">科目為系統建議</Badge>}
            {q.status === "ARCHIVED" && <Badge tone="red">已下架</Badge>}
          </div>
        </Link>
      ))}
    </div>
  );
}
