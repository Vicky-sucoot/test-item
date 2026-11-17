import Link from "next/link";
import { OPTION_KEYS, SOURCE_TYPE_LABEL, optionLabel, subjectLabel, LAW_SUBJECTS, type Subject } from "@/lib/constants";
import { formatAnswer, parseAnswerSet } from "@/lib/answer";
import type { Citation, DuplicateRef, QuestionRow } from "@/lib/questions";
import {
  AnswerStatusBadge,
  Badge,
  DemoNotice,
  ExplanationBadge,
  LawRecheckBadge,
  SourceBadge,
  SubjectBadge,
  VerifyBadge,
} from "./Badges";

export function paperTitle(p: {
  source_type: string;
  bank: string | null;
  year: number | null;
  exam_name: string;
}): string {
  if (p.source_type === "DEMO") return p.exam_name;
  return [p.bank, p.year ? `${p.year} 年` : null, p.exam_name].filter(Boolean).join(" ");
}

export function QuestionHeader({ q }: { q: QuestionRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SubjectBadge subject={q.subject} />
      {q.topic_name && <Badge>{q.topic_name}</Badge>}
      <SourceBadge type={q.source_type} />
      <span className="text-xs muted">
        {paperTitle(q)}
        {q.number_in_paper != null ? ` 第 ${q.number_in_paper} 題` : " （題號缺少）"}
      </span>
      {q.dup_count > 1 && <Badge tone="purple">重複 ×{q.dup_count}</Badge>}
    </div>
  );
}

export function Options({
  q,
  chosen,
  showAnswer,
}: {
  q: Pick<QuestionRow, "option_a" | "option_b" | "option_c" | "option_d" | "option_style" | "official_answer" | "answer_status">;
  chosen?: string | null;
  showAnswer?: boolean;
}) {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
  const ans = showAnswer && q.answer_status !== "MISSING" ? parseAnswerSet(q.official_answer) : null;
  return (
    <ol className="space-y-1.5">
      {OPTION_KEYS.map((k, i) => {
        if (!opts[i]) return null;
        const isAns = ans === "ALL" || (ans instanceof Set && ans.has(k));
        const isChosen = chosen === k;
        let cls = "border-slate-200";
        if (showAnswer && isAns) cls = "border-emerald-400 bg-emerald-50";
        else if (showAnswer && isChosen) cls = "border-red-400 bg-red-50";
        else if (isChosen) cls = "border-sky-400 bg-sky-50";
        return (
          <li key={k} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
            <span className="font-semibold">{optionLabel(k, q.option_style)}</span>
            <span className="flex-1">{opts[i]}</span>
            {showAnswer && isAns && <span className="text-xs text-emerald-700">答案</span>}
            {isChosen && <span className="text-xs text-sky-700">你的選擇</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** 答案、解析、來源、重複、法規等完整資訊 */
export function QuestionDetails({
  q,
  citations,
  duplicates,
}: {
  q: QuestionRow;
  citations: Citation[];
  duplicates: DuplicateRef[];
}) {
  const isLaw = LAW_SUBJECTS.includes(q.subject as Subject);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">答案：</span>
        <span className={q.answer_status === "MISSING" ? "font-semibold text-red-700" : "font-semibold"}>
          {q.answer_status === "MISSING" ? "缺少官方答案（不推測、不判分）" : formatAnswer(q.official_answer, q.option_style)}
        </span>
        <AnswerStatusBadge status={q.answer_status} />
        {q.answer_note && <span className="text-xs muted">{q.answer_note}</span>}
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-semibold">解析</span>
          <ExplanationBadge status={q.explanation_status} />
        </div>
        {q.explanation ? (
          <>
            {q.explanation_status !== "REVIEWED" && (
              <p className="mb-1 text-xs text-amber-800">此解析為草稿，尚未經審核，請斟酌參考。</p>
            )}
            <p className="whitespace-pre-wrap leading-relaxed">{q.explanation}</p>
          </>
        ) : (
          <p className="muted">尚無解析。</p>
        )}
      </div>

      <div className="rounded-lg border p-3" style={{ borderColor: "var(--line)" }}>
        <p className="mb-1 font-semibold">來源</p>
        <DemoNotice type={q.source_type} />
        <dl className="mt-1 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 text-xs">
          <dt className="muted">來源類型</dt>
          <dd>{SOURCE_TYPE_LABEL[q.source_type]}</dd>
          {q.source_type !== "DEMO" && (
            <>
              <dt className="muted">銀行</dt>
              <dd>{q.bank ?? <Missing />}</dd>
              <dt className="muted">年度</dt>
              <dd>{q.year ?? <Missing />}</dd>
            </>
          )}
          <dt className="muted">甄試／題組</dt>
          <dd>{q.exam_name}{q.position ? `（${q.position}）` : ""}</dd>
          {q.subject_label && (
            <>
              <dt className="muted">原卷科目</dt>
              <dd>{q.subject_label}</dd>
            </>
          )}
          <dt className="muted">題號</dt>
          <dd>{q.number_in_paper ?? <Missing />}</dd>
          <dt className="muted">原始試卷網址</dt>
          <dd className="break-all">
            {q.paper_url ? (
              <a className="link" href={q.paper_url} target="_blank" rel="noreferrer">
                {q.paper_url}
              </a>
            ) : q.source_type === "DEMO" ? (
              "不適用（自編）"
            ) : (
              <Missing />
            )}
          </dd>
          {q.source_type !== "DEMO" && (
            <>
              <dt className="muted">官方答案網址</dt>
              <dd className="break-all">
                {q.answer_url ? (
                  <a className="link" href={q.answer_url} target="_blank" rel="noreferrer">
                    {q.answer_url}
                  </a>
                ) : (
                  <Missing />
                )}
              </dd>
            </>
          )}
          <dt className="muted">科目分類</dt>
          <dd>{subjectLabel(q.subject)}</dd>
        </dl>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <VerifyBadge status={q.verify_status} />
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
          <p className="mb-1 font-semibold">重複題：此題亦出現於</p>
          <ul className="space-y-1 text-xs">
            {duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-1.5">
                <SourceBadge type={d.source_type} />
                <Link className="link" href={`/q/${d.id}`}>
                  {paperTitle(d)} {d.number_in_paper != null ? `第 ${d.number_in_paper} 題` : "（題號缺少）"}
                </Link>
                <span className="muted">
                  該卷答案：{d.answer_status === "MISSING" ? "缺少" : formatAnswer(d.official_answer, d.option_style)}
                </span>
                {d.status !== "PUBLISHED" && <Badge tone="gray">已下架</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLaw && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <p className="mb-1 font-semibold">法規資訊</p>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1 text-xs">
            <dt className="muted">考試當時適用法規</dt>
            <dd>{q.law_at_exam ?? (q.source_type === "DEMO" ? "未填（示範題無考試時點）" : <Missing />)}</dd>
            <dt className="muted">目前法規</dt>
            <dd className="flex flex-wrap items-center gap-1">
              <LawRecheckBadge status={q.law_recheck} />
              {q.law_recheck_date && <span className="muted">核對日期 {q.law_recheck_date}</span>}
            </dd>
          </dl>
          <p className="mt-2 text-xs font-semibold">引用條文</p>
          {citations.length ? (
            <ul className="mt-1 space-y-0.5 text-xs">
              {citations.map((c) => (
                <li key={c.id}>
                  {c.law_name} {c.article_no}
                  {c.version_note ? `（${c.version_note}）` : ""} —{" "}
                  {c.checked_on ? (
                    <>
                      核對日期 {c.checked_on}
                      {c.checked_source_url && (
                        <>
                          {" "}
                          <a className="link" href={c.checked_source_url} target="_blank" rel="noreferrer">
                            核對來源
                          </a>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-red-700">條文未核對</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs muted">尚未建立法條引用（條文未核對）。</p>
          )}
        </div>
      )}
    </div>
  );
}

function Missing() {
  return <span className="font-medium text-red-700">缺少</span>;
}
