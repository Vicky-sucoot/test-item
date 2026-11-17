import { EXAM_PRESETS } from "@/lib/exam";
import { RATIO_MODE_LABEL, apportion, getExamSettings, percentText, realRatio, resolveRatio, type RatioMode } from "@/lib/examRatio";
import { BANKS, subjectLabel } from "@/lib/constants";
import { Badge } from "@/components/Badges";
import { paperTitle } from "@/components/QuestionView";
import { saveExamSettingsAction } from "../actions";

export default async function ExamSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  return (
    <div className="space-y-4">
      <h1 className="h1">模擬考各科比例</h1>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        系統不內建、也不推測任何銀行的各科題數比例。比例只來自：
        <strong>（1）</strong>你匯入並勾選「已與原卷核對」的銀行甄試真題（FIT 參考試題與示範題不列入統計），或
        <strong>（2）</strong>你手動輸入的比例。兩者皆無時，暫以平均分配並在模擬考頁標示。
      </div>

      {EXAM_PRESETS.map((p) => {
        const s = getExamSettings(p.key);
        const r = resolveRatio(p.subjects, s);
        const real = r.real ?? realRatio(p.subjects, { bank: s.basis_bank, yearFrom: s.basis_year_from, yearTo: s.basis_year_to });
        const planned = apportion(p.count, r.weights);
        const pctReal = percentText(real.counts);
        return (
          <section key={p.key} id={p.key} className="card space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="h2">{p.name}</h2>
              <span className="text-sm muted">{p.count} 題・{p.minutes} 分鐘</span>
              {saved === p.key && <Badge tone="green">已儲存</Badge>}
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>
                目前採用：<strong>{r.label}</strong>
                {r.used !== r.mode && <Badge tone="amber">已退回平均分配</Badge>}
              </p>
              <p className="mt-1">
                預計出題：{p.subjects.map((x, i) => `${subjectLabel(x)} ${planned[i]} 題`).join("、")}
              </p>
              {r.warnings.map((w, i) => (
                <p key={i} className="mt-1 text-xs text-amber-800">⚠ {w}</p>
              ))}
            </div>

            <form action={saveExamSettingsAction} className="space-y-3">
              <input type="hidden" name="preset_key" value={p.key} />
              <fieldset className="space-y-1 text-sm">
                <legend className="label">比例依據</legend>
                {(["AUTO", "MANUAL", "EVEN"] as RatioMode[]).map((m) => (
                  <label key={m} className="flex items-center gap-1.5">
                    <input type="radio" name="ratio_mode" value={m} defaultChecked={s.ratio_mode === m} />
                    {RATIO_MODE_LABEL[m]}
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <label className="label" htmlFor={`${p.key}-bank`}>自動統計：限定銀行</label>
                  <select id={`${p.key}-bank`} name="basis_bank" className="input" defaultValue={s.basis_bank ?? ""}>
                    <option value="">全部銀行</option>
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`${p.key}-from`}>自動統計：起始年度</label>
                  <input id={`${p.key}-from`} name="basis_year_from" className="input" inputMode="numeric" placeholder="例：110" defaultValue={s.basis_year_from ?? ""} />
                </div>
                <div>
                  <label className="label" htmlFor={`${p.key}-to`}>自動統計：結束年度</label>
                  <input id={`${p.key}-to`} name="basis_year_to" className="input" inputMode="numeric" placeholder="例：114" defaultValue={s.basis_year_to ?? ""} />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {p.subjects.map((x) => (
                  <div key={x}>
                    <label className="label" htmlFor={`${p.key}-w-${x}`}>手動比例：{subjectLabel(x)}（題數或百分比皆可）</label>
                    <input id={`${p.key}-w-${x}`} name={`w_${x}`} className="input" inputMode="decimal" defaultValue={s.manual_weights[x] ?? ""} />
                  </div>
                ))}
              </div>
              <button className="btn btn-primary">儲存設定</button>
            </form>

            <div>
              <h3 className="mb-1 font-semibold">自動統計結果（目前篩選條件）</h3>
              {real.total ? (
                <>
                  <p className="text-sm">
                    {p.subjects.map((x, i) => `${subjectLabel(x)} ${real.counts[i]} 題（${pctReal[i]}）`).join("、")}・共 {real.papers.length} 份試卷
                  </p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>試卷</th>
                          <th>原卷科目</th>
                          {p.subjects.map((x) => <th key={x}>{subjectLabel(x)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {real.papers.map((pp) => (
                          <tr key={pp.id}>
                            <td>{paperTitle({ ...pp, source_type: "BANK_EXAM" })}</td>
                            <td>{pp.subject_label ?? "—"}</td>
                            {p.subjects.map((x) => <td key={x}>{pp.counts[x] ?? 0}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm muted">
                  目前沒有符合條件、已核對的銀行甄試真題。請先在「匯入」頁匯入官方原卷並逐題核對、發布。
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
