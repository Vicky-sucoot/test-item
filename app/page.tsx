import Link from "next/link";
import { startPracticeAction } from "./actions";
import { SUBJECTS, SUBJECT_LABEL } from "@/lib/constants";
import { pct, subjectStats } from "@/lib/stats";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const stats = subjectStats();
  const realCount = (
    db()
      .prepare("SELECT COUNT(*) n FROM questions q JOIN exam_papers p ON p.id=q.paper_id WHERE p.source_type!='DEMO' AND q.status='PUBLISHED'")
      .get() as { n: number }
  ).n;
  const unclassified = stats.find((s) => s.subject === "UNCLASSIFIED")!;
  const totalWrong = stats.reduce((n, s) => n + s.wrong_active, 0);
  const totalBookmarks = stats.reduce((n, s) => n + s.bookmarks, 0);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="h1">分科刷題</h1>
        <p className="mt-1 text-sm muted">會計學・貨幣銀行學・票據法・銀行法</p>
        {realCount === 0 && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            目前題庫只有<strong>自編示範題</strong>（非歷屆真題）。取得並核對官方原卷後，可在「管理」頁匯入 PDF 或 CSV。
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {SUBJECTS.map((s) => {
          const st = stats.find((x) => x.subject === s)!;
          return (
            <div key={s} className="card flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="h2">{SUBJECT_LABEL[s]}</h2>
                <span className="text-sm muted">{st.question_count} 題</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold">{pct(st.correct, st.gradable)}</div>
                  <div className="text-xs muted">正確率</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold">{st.answered}</div>
                  <div className="text-xs muted">已作答</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold">{st.wrong_active}</div>
                  <div className="text-xs muted">待複習錯題</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={startPracticeAction}>
                  <input type="hidden" name="subject" value={s} />
                  <input type="hidden" name="count" value="10" />
                  <button className="btn btn-primary" disabled={!st.question_count}>
                    隨機練習 10 題
                  </button>
                </form>
                {st.wrong_active > 0 && (
                  <form action={startPracticeAction}>
                    <input type="hidden" name="subject" value={s} />
                    <input type="hidden" name="only" value="wrong" />
                    <input type="hidden" name="count" value="50" />
                    <button className="btn btn-outline">複習錯題</button>
                  </form>
                )}
                <Link className="btn btn-outline" href={`/questions?subject=${s}`}>
                  瀏覽題目
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="h2">限時模擬考</h2>
          <p className="text-sm muted">會計學＋貨幣銀行學 80 題／90 分鐘；票據法＋銀行法 50 題／60 分鐘</p>
        </div>
        <Link className="btn btn-primary" href="/exam">前往模擬考</Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/review" className="card hover:bg-slate-50">
          <div className="text-2xl font-bold">{totalWrong}</div>
          <div className="text-sm muted">待複習錯題</div>
        </Link>
        <Link href="/review?tab=bookmarks" className="card hover:bg-slate-50">
          <div className="text-2xl font-bold">{totalBookmarks}</div>
          <div className="text-sm muted">收藏題目</div>
        </Link>
        <Link href="/questions?subject=UNCLASSIFIED" className="card hover:bg-slate-50">
          <div className="text-2xl font-bold">{unclassified.question_count}</div>
          <div className="text-sm muted">待人工分類題目</div>
        </Link>
      </section>
    </div>
  );
}
