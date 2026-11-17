import Link from "next/link";
import { attemptHistory, dailyStats, pct, subjectStats, topicStats } from "@/lib/stats";
import { finalizeExpiredExams } from "@/lib/exam";
import { subjectLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MODE_LABEL: Record<string, string> = { PRACTICE: "練習", REVIEW: "錯題／收藏複習", RETRY_WRONG: "重練錯題", EXAM: "模擬考" };

function Bar({ value, total }: { value: number; total: number }) {
  const w = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-slate-100" role="img" aria-label={`${w}%`}>
      <div className="h-full rounded" style={{ width: `${w}%`, background: "var(--brand)" }} />
    </div>
  );
}

export default function StatsPage() {
  finalizeExpiredExams();
  const subjects = subjectStats().filter((s) => s.subject !== "UNCLASSIFIED" || s.question_count > 0);
  const topics = topicStats();
  const history = attemptHistory();
  const daily = dailyStats();

  return (
    <div className="space-y-4">
      <h1 className="h1">進度統計</h1>

      <section className="card space-y-3">
        <h2 className="h2">各科正確率</h2>
        <div className="space-y-3">
          {subjects.map((s) => (
            <div key={s.subject}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{subjectLabel(s.subject)}</span>
                <span className="muted">
                  正確率 <strong className="text-slate-900">{pct(s.correct, s.gradable)}</strong>（{s.correct}/{s.gradable}）・
                  作答 {s.answered}・無法判分 {s.ungradable}・題庫 {s.question_count}・錯題 {s.wrong_active}・已熟悉 {s.wrong_familiar}
                </span>
              </div>
              <Bar value={s.correct} total={s.gradable} />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="h2 mb-2">各主題正確率</h2>
        {topics.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>科目</th><th>主題</th><th>答對／可判分</th><th>正確率</th></tr>
              </thead>
              <tbody>
                {topics.map((t, i) => (
                  <tr key={i}>
                    <td>{subjectLabel(t.subject)}</td>
                    <td>{t.topic}</td>
                    <td>{t.correct}／{t.gradable}</td>
                    <td>{pct(t.correct, t.gradable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm muted">尚無作答資料。</p>
        )}
      </section>

      <section className="card">
        <h2 className="h2 mb-2">近日作答</h2>
        {daily.length ? (
          <table className="table">
            <thead><tr><th>日期</th><th>作答題數</th><th>正確率</th></tr></thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day}><td>{d.day}</td><td>{d.answered}</td><td>{pct(d.correct, d.gradable)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm muted">尚無作答資料。</p>
        )}
      </section>

      <section className="card">
        <h2 className="h2 mb-2">作答紀錄</h2>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>時間</th><th>類型</th><th>內容</th><th>得分</th><th></th></tr></thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{a.submitted_at ?? a.started_at}</td>
                    <td className="whitespace-nowrap">{MODE_LABEL[a.mode] ?? a.mode}</td>
                    <td>{a.title}</td>
                    <td className="whitespace-nowrap">
                      {a.submitted_at ? `${a.correct}/${a.gradable}（${pct(a.correct, a.gradable)}）` : "未交卷"}
                    </td>
                    <td>
                      <Link className="link whitespace-nowrap" href={a.submitted_at ? `/practice/${a.id}/result` : `/practice/${a.id}`}>
                        {a.submitted_at ? "查看" : "繼續作答"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm muted">尚無作答紀錄。</p>
        )}
      </section>
    </div>
  );
}
