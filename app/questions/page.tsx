import Link from "next/link";
import { startPracticeAction } from "../actions";
import { ALL_SUBJECTS, BANKS, SOURCE_TYPES, SOURCE_TYPE_SHORT, SUBJECT_LABEL } from "@/lib/constants";
import { filtersToQuery, getFilterOptions, getTopics, listQuestions, parseFilters } from "@/lib/questions";
import { AnswerStatusBadge, Badge } from "@/components/Badges";
import { QuestionHeader } from "@/components/QuestionView";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function QuestionsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = listQuestions(f, 30, (page - 1) * 30);
  const { years, exams } = getFilterOptions();
  const topics = getTopics().filter((t) => !f.subject || t.subject === f.subject);
  const qs = filtersToQuery(f);
  const pages = Math.max(1, Math.ceil(total / 30));

  const hidden = (
    <>
      {f.sourceTypes.map((s) => (
        <input key={s} type="hidden" name="src" value={s} />
      ))}
      {f.bank && <input type="hidden" name="bank" value={f.bank} />}
      {f.year && <input type="hidden" name="year" value={f.year} />}
      {f.exam && <input type="hidden" name="exam" value={f.exam} />}
      {f.subject && <input type="hidden" name="subject" value={f.subject} />}
      {f.topicId && <input type="hidden" name="topic" value={f.topicId} />}
      {f.only && <input type="hidden" name="only" value={f.only} />}
      {f.dedupe && <input type="hidden" name="dedupe" value="1" />}
      {f.q && <input type="hidden" name="q" value={f.q} />}
    </>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
      <aside className="card h-fit md:sticky md:top-16">
        <form className="space-y-3" method="get">
          <h2 className="font-semibold">篩選題目</h2>
          <fieldset>
            <legend className="label">來源類型</legend>
            <div className="flex flex-wrap gap-2 text-sm">
              {SOURCE_TYPES.map((s) => (
                <label key={s} className="flex items-center gap-1">
                  <input type="checkbox" name="src" value={s} defaultChecked={f.sourceTypes.includes(s)} />
                  {SOURCE_TYPE_SHORT[s]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="subject">科目</label>
            <select id="subject" name="subject" className="input" defaultValue={f.subject ?? ""}>
              <option value="">全部科目</option>
              {ALL_SUBJECTS.map((s) => (
                <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="topic">主題</label>
            <select id="topic" name="topic" className="input" defaultValue={f.topicId ?? ""}>
              <option value="">全部主題</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {f.subject ? "" : `${SUBJECT_LABEL[t.subject as keyof typeof SUBJECT_LABEL]}－`}{t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bank">銀行</label>
            <select id="bank" name="bank" className="input" defaultValue={f.bank ?? ""}>
              <option value="">全部銀行</option>
              {BANKS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="year">年度</label>
              <select id="year" name="year" className="input" defaultValue={f.year ?? ""}>
                <option value="">全部</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="only">範圍</label>
              <select id="only" name="only" className="input" defaultValue={f.only ?? ""}>
                <option value="">全部</option>
                <option value="wrong">待複習錯題</option>
                <option value="familiar">已熟悉錯題</option>
                <option value="wrongall">所有錯題</option>
                <option value="bookmark">收藏</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="exam">甄試名稱／題組</label>
            <select id="exam" name="exam" className="input" defaultValue={f.exam ?? ""}>
              <option value="">全部</option>
              {exams.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q">關鍵字</label>
            <input id="q" name="q" className="input" defaultValue={f.q ?? ""} placeholder="題幹或選項文字" />
          </div>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="dedupe" value="1" defaultChecked={f.dedupe} />
            合併重複題（同組只出一題）
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1">套用</button>
            <Link className="btn btn-outline" href="/questions">清除</Link>
          </div>
        </form>
      </aside>

      <section className="space-y-3">
        <div className="card space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="h1">題庫</h1>
            <span className="text-sm muted">符合 {total} 題</span>
          </div>
          {sp.empty && <p className="rounded bg-red-50 p-2 text-sm text-red-800">沒有符合條件的題目可練習。</p>}
          <form action={startPracticeAction} className="flex flex-wrap items-end gap-2">
            {hidden}
            <div>
              <label className="label" htmlFor="count">題數</label>
              <input id="count" name="count" type="number" min={1} max={200} defaultValue={Math.min(20, total || 20)} className="input w-24" />
            </div>
            <div>
              <label className="label" htmlFor="order">順序</label>
              <select id="order" name="order" className="input" defaultValue="random">
                <option value="random">隨機</option>
                <option value="seq">依試卷題號</option>
              </select>
            </div>
            <label className="flex items-center gap-1 pb-2 text-sm">
              <input type="checkbox" name="instant" value="1" />
              每題作答後立即看答案
            </label>
            <button className="btn btn-primary" disabled={!total}>開始逐題練習</button>
          </form>
        </div>

        {rows.map((q) => (
          <Link key={q.id} href={`/q/${q.id}`} className="card block space-y-2 hover:bg-slate-50">
            <QuestionHeader q={q} />
            <p className="line-clamp-2 text-sm">{q.stem}</p>
            <div className="flex flex-wrap gap-1.5">
              <AnswerStatusBadge status={q.answer_status} />
              {q.bookmarked ? <Badge tone="amber">★ 收藏</Badge> : null}
              {q.wrong_status === "ACTIVE" && <Badge tone="red">錯題待複習</Badge>}
              {q.wrong_status === "FAMILIAR" && <Badge tone="green">已熟悉</Badge>}
            </div>
          </Link>
        ))}
        {pages > 1 && (
          <nav className="flex items-center justify-center gap-2 text-sm">
            {page > 1 && <Link className="btn btn-outline btn-sm" href={`/questions?${qs}&page=${page - 1}`}>上一頁</Link>}
            <span className="muted">{page} / {pages}</span>
            {page < pages && <Link className="btn btn-outline btn-sm" href={`/questions?${qs}&page=${page + 1}`}>下一頁</Link>}
          </nav>
        )}
      </section>
    </div>
  );
}
