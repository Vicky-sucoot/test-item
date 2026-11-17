import Link from "next/link";
import { startExamAction } from "../actions";
import { EXAM_PRESETS, examHistory, examPool, finalizeExpiredExams, formatDuration, usedSeconds } from "@/lib/exam";
import { SOURCE_TYPES, SOURCE_TYPE_SHORT, SUBJECTS, SUBJECT_LABEL, subjectLabel } from "@/lib/constants";
import { pct } from "@/lib/stats";
import { Badge } from "@/components/Badges";
import { allocateByWeights, apportion, getExamSettings, percentText, resolveRatio } from "@/lib/examRatio";

export const dynamic = "force-dynamic";

export default async function ExamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  finalizeExpiredExams();
  const avail = Object.fromEntries(SUBJECTS.map((s) => [s, examPool(s, [...SOURCE_TYPES], true).length]));
  const history = examHistory();

  return (
    <div className="space-y-4">
      <h1 className="h1">限時模擬考</h1>
      <p className="text-sm muted">
        時間到會自動交卷。模擬考中不顯示答案，交卷後才看答案與解析；未作答的題目計為答錯（不加入錯題本），答錯的題目會加入錯題本。同一重複群組只會出一題。
      </p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="text-xs muted">
        各科比例依你匯入並核對過的銀行甄試真題自動統計，或由你在「管理 → 模擬考比例」手動設定；系統不推測官方比例。
        <Link className="link ml-1" href="/admin/exam-settings">調整比例設定</Link>
      </p>

      <form action={startExamAction} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {EXAM_PRESETS.map((p) => {
            const have = p.subjects.reduce((n, s) => n + (avail[s] ?? 0), 0);
            const ratio = resolveRatio(p.subjects, getExamSettings(p.key));
            const planned = apportion(p.count, ratio.weights);
            const actual = allocateByWeights(p.count, ratio.weights, p.subjects.map((s) => avail[s] ?? 0));
            const pcts = percentText(ratio.weights);
            const short = actual.some((a, i) => a !== planned[i]);
            return (
              <div key={p.key} className="card flex flex-col gap-3">
                <div>
                  <h2 className="h2">{p.name}</h2>
                  <p className="text-sm">
                    <strong>{p.count} 題</strong>・<strong>{p.minutes} 分鐘</strong>
                  </p>
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <p className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold">出題比例：</span>
                      <span>{ratio.label}</span>
                      {ratio.used !== ratio.mode && <Badge tone="amber">暫以平均分配</Badge>}
                    </p>
                    <table className="mt-1 w-full">
                      <thead>
                        <tr className="text-left muted">
                          <th className="font-normal">科目</th>
                          <th className="font-normal">比例</th>
                          <th className="font-normal">預計</th>
                          <th className="font-normal">題庫可出</th>
                          <th className="font-normal">本次實際</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.subjects.map((s, i) => (
                          <tr key={s}>
                            <td>{subjectLabel(s)}</td>
                            <td>{pcts[i]}</td>
                            <td>{planned[i]}</td>
                            <td>{avail[s]}</td>
                            <td className={actual[i] !== planned[i] ? "font-semibold text-amber-800" : ""}>{actual[i]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ratio.warnings.map((w, i) => (
                      <p key={i} className="mt-1 text-amber-800">⚠ {w}</p>
                    ))}
                    {short && have >= p.count && (
                      <p className="mt-1 text-amber-800">部分科目題數不足，差額已依比例由其他科補足。</p>
                    )}
                    <p className="mt-1 muted">題庫可出題數以全部來源、排除缺答案計算。</p>
                  </div>
                  {have < p.count && (
                    <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
                      題庫目前只有 {have} 題可出，本次將以 {have} 題進行，時限仍為 {p.minutes} 分鐘。
                    </p>
                  )}
                </div>
                <button name="preset" value={p.key} className="btn btn-primary mt-auto" disabled={!have}>
                  開始模擬考
                </button>
              </div>
            );
          })}
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold">出題範圍（套用於上方與自訂模擬考）</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {SOURCE_TYPES.map((s) => (
              <label key={s} className="flex items-center gap-1">
                <input type="checkbox" name="src" value={s} defaultChecked />
                {SOURCE_TYPE_SHORT[s]}
              </label>
            ))}
            <label className="flex items-center gap-1">
              <input type="checkbox" name="include_missing" value="1" />
              包含缺少官方答案的題目（不計分）
            </label>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">自訂模擬考</summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <fieldset className="flex flex-wrap gap-3 text-sm">
                <legend className="label">科目</legend>
                {SUBJECTS.map((s) => (
                  <label key={s} className="flex items-center gap-1">
                    <input type="checkbox" name="subject" value={s} />
                    {SUBJECT_LABEL[s]}（{avail[s]}）
                  </label>
                ))}
              </fieldset>
              <div>
                <label className="label" htmlFor="count">題數</label>
                <input id="count" name="count" type="number" min={1} max={200} defaultValue={50} className="input w-24" />
              </div>
              <div>
                <label className="label" htmlFor="ratio_mode">各科比例</label>
                <select id="ratio_mode" name="ratio_mode" className="input" defaultValue="AUTO">
                  <option value="AUTO">依已核對真題統計（無資料時平均）</option>
                  <option value="EVEN">平均分配</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="minutes">時間（分鐘）</label>
                <input id="minutes" name="minutes" type="number" min={1} max={300} defaultValue={60} className="input w-24" />
              </div>
              <button name="preset" value="CUSTOM" className="btn btn-outline">開始自訂模擬考</button>
            </div>
          </details>
        </div>
      </form>

      <section className="card">
        <h2 className="h2 mb-2">模擬考紀錄</h2>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>開始時間</th><th>考試</th><th>得分</th><th>作答</th><th>用時／時限</th><th></th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap">{h.started_at}</td>
                    <td>{h.title?.replace("模擬考・", "")}</td>
                    <td className="whitespace-nowrap">
                      {h.submitted_at ? `${pct(h.correct, h.gradable)}（${h.correct}/${h.gradable}）` : "進行中"}
                    </td>
                    <td className="whitespace-nowrap">{h.submitted_at ? `${h.answered}/${h.total}` : "—"}</td>
                    <td className="whitespace-nowrap">
                      {formatDuration(usedSeconds(h.started_at, h.submitted_at, h.time_limit_sec, h.submit_reason))}／{h.time_limit_sec / 60} 分
                      {h.submit_reason === "TIMEOUT" && <> <Badge tone="amber">時間到</Badge></>}
                    </td>
                    <td>
                      <Link className="link whitespace-nowrap" href={h.submitted_at ? `/practice/${h.id}/result` : `/practice/${h.id}`}>
                        {h.submitted_at ? "查看" : "繼續作答"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm muted">尚無模擬考紀錄。</p>
        )}
      </section>
    </div>
  );
}
