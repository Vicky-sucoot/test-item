import Link from "next/link";
import { db } from "@/lib/db";
import { QUESTION_SELECT, type QuestionRow } from "@/lib/questions";
import { SUBJECTS, SUBJECT_LABEL, FAMILIAR_STREAK } from "@/lib/constants";
import { QuestionHeader } from "@/components/QuestionView";
import { Badge } from "@/components/Badges";
import { setWrongStatusAction, startPracticeAction, toggleBookmarkFormAction } from "../actions";

export const dynamic = "force-dynamic";

type Row = QuestionRow & {
  wrong_count: number | null;
  correct_streak: number | null;
  last_attempt_at: string | null;
  familiar_at: string | null;
};

const TABS = [
  { key: "wrong", label: "待複習錯題" },
  { key: "familiar", label: "已熟悉" },
  { key: "bookmarks", label: "收藏" },
];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string; subject?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "wrong";
  const subject = sp.subject && (SUBJECTS as readonly string[]).includes(sp.subject) ? sp.subject : "";
  const base = QUESTION_SELECT.replace(
    "FROM questions q\nJOIN",
    ", w.wrong_count, w.correct_streak, w.last_attempt_at, w.familiar_at\nFROM questions q LEFT JOIN wrong_book w ON w.question_id = q.id\nJOIN",
  );
  const where =
    tab === "bookmarks"
      ? "EXISTS(SELECT 1 FROM bookmarks b WHERE b.question_id=q.id)"
      : `w.status = '${tab === "familiar" ? "FAMILIAR" : "ACTIVE"}'`;
  const rows = db()
    .prepare(
      `${base} WHERE ${where} AND q.status='PUBLISHED' ${subject ? "AND q.subject = ?" : ""}
       ORDER BY ${tab === "bookmarks" ? "q.id" : "w.last_attempt_at DESC"}`,
    )
    .all(...(subject ? [subject] : [])) as Row[];
  const only = tab === "bookmarks" ? "bookmark" : tab;

  return (
    <div className="space-y-4">
      <h1 className="h1">錯題本與收藏</h1>
      <p className="text-sm muted">
        答錯的題目會自動加入錯題本；連續答對 {FAMILIAR_STREAK} 次後標記為「已熟悉」，作答紀錄仍保留，你可以選擇繼續複習。
      </p>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/review?tab=${t.key}${subject ? `&subject=${subject}` : ""}`}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-outline"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="card flex flex-wrap items-end gap-2">
        <form className="flex items-end gap-2" method="get">
          <input type="hidden" name="tab" value={tab} />
          <div>
            <label className="label" htmlFor="subject">科目</label>
            <select id="subject" name="subject" className="input" defaultValue={subject}>
              <option value="">全部科目</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-outline">篩選</button>
        </form>
        <form action={startPracticeAction} className="ml-auto flex items-end gap-2">
          <input type="hidden" name="only" value={only} />
          {subject && <input type="hidden" name="subject" value={subject} />}
          <input type="hidden" name="count" value="200" />
          <label className="flex items-center gap-1 pb-2 text-sm">
            <input type="checkbox" name="instant" value="1" defaultChecked />
            即時看答案
          </label>
          <button className="btn btn-primary" disabled={!rows.length}>
            {tab === "familiar" ? "繼續複習已熟悉題目" : tab === "bookmarks" ? "練習收藏題" : "開始複習錯題"}（{rows.length}）
          </button>
        </form>
      </div>

      {!rows.length && <p className="card text-sm muted">目前沒有題目。</p>}
      {rows.map((q) => (
        <div key={q.id} className="card space-y-2">
          <QuestionHeader q={q} />
          <Link href={`/q/${q.id}`} className="block text-sm hover:underline">{q.stem}</Link>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {q.wrong_count != null && (
              <>
                <Badge tone="red">答錯 {q.wrong_count} 次</Badge>
                <Badge>連續答對 {q.correct_streak} 次</Badge>
                {q.wrong_status === "FAMILIAR" && <Badge tone="green">已熟悉 {q.familiar_at?.slice(0, 10)}</Badge>}
                <span className="muted">最近作答 {q.last_attempt_at}</span>
              </>
            )}
            <div className="ml-auto flex gap-2">
              {q.wrong_status === "FAMILIAR" && (
                <form action={setWrongStatusAction}>
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="status" value="ACTIVE" />
                  <button className="btn btn-outline btn-sm">移回待複習</button>
                </form>
              )}
              {q.wrong_status === "ACTIVE" && (
                <form action={setWrongStatusAction}>
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="status" value="FAMILIAR" />
                  <button className="btn btn-outline btn-sm">手動標為已熟悉</button>
                </form>
              )}
              <form action={toggleBookmarkFormAction}>
                <input type="hidden" name="questionId" value={q.id} />
                <button className="btn btn-outline btn-sm">{q.bookmarked ? "★ 取消收藏" : "☆ 收藏"}</button>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
