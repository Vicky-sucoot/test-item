import Link from "next/link";
import { BANKS, SOURCE_TYPES, SOURCE_TYPE_LABEL, SUBJECTS, SUBJECT_LABEL } from "@/lib/constants";
import { listJobs } from "@/lib/import/service";
import { importCsvAction, importPdfAction } from "../actions";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const jobs = listJobs();
  return (
    <div className="space-y-4">
      <h1 className="h1">匯入題目</h1>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="text-sm muted">
        匯入後所有題目先進入「待核對」清單，你逐題對照原卷、修正後勾選「已與原卷核對」，才會發布到本機題庫。系統不會自動補答案。
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="h2">PDF 匯入（文字型 PDF）</h2>
          <p className="text-xs muted">
            第一階段只能擷取有文字層的 PDF；掃描影像檔請先轉為 CSV。原卷若為「綜合科目」，請選「逐題分類」，系統會依關鍵字建議科目，無法判斷者標為「待人工分類」。
          </p>
          <form action={importPdfAction} className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="label" htmlFor="source_type">來源類型</label>
                <select id="source_type" name="source_type" className="input" defaultValue="BANK_EXAM">
                  {SOURCE_TYPES.map((s) => (
                    <option key={s} value={s}>{SOURCE_TYPE_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="bank">銀行</label>
                <select id="bank" name="bank" className="input" defaultValue="">
                  <option value="">（無／FIT／示範）</option>
                  {BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="year">年度（民國）</label>
                <input id="year" name="year" className="input" inputMode="numeric" placeholder="例：113" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="exam_name">甄試名稱</label>
                <input id="exam_name" name="exam_name" className="input" placeholder="例：113 年新進人員甄試" />
              </div>
              <div>
                <label className="label" htmlFor="position">職缺／類別</label>
                <input id="position" name="position" className="input" placeholder="例：一般行員" />
              </div>
              <div>
                <label className="label" htmlFor="exam_date">考試日期</label>
                <input id="exam_date" name="exam_date" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="subject_label">原卷科目名稱</label>
                <input id="subject_label" name="subject_label" className="input" placeholder="例：綜合科目" />
              </div>
              <div>
                <label className="label" htmlFor="subject_mode">本卷科目</label>
                <select id="subject_mode" name="subject_mode" className="input" defaultValue="MIXED">
                  <option value="MIXED">綜合科目（逐題分類）</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>全卷皆為{SUBJECT_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="paper_url">原始試卷網址（官方）</label>
                <input id="paper_url" name="paper_url" type="url" className="input" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="answer_url">官方答案網址</label>
                <input id="answer_url" name="answer_url" type="url" className="input" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="announcement_url">甄試公告網址</label>
                <input id="announcement_url" name="announcement_url" type="url" className="input" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="file">試題 PDF（必填）</label>
                <input id="file" name="file" type="file" accept="application/pdf,.pdf" className="input" required />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="answer_file">官方答案 PDF（選填）</label>
                <input id="answer_file" name="answer_file" type="file" accept="application/pdf,.pdf" className="input" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="answer_text">或貼上官方答案文字（選填，例：1.C 2.A 3.D）</label>
                <textarea id="answer_text" name="answer_text" className="input min-h-16" />
              </div>
            </div>
            <button className="btn btn-primary">上傳並擷取</button>
          </form>
        </section>

        <section className="card space-y-3">
          <h2 className="h2">CSV 匯入</h2>
          <p className="text-xs muted">
            UTF-8 編碼，第一行為欄名（英文或中文欄名皆可）。每列可屬於不同試卷。空白答案會標示為「缺少官方答案」。
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <a className="link" href="/templates/questions-template.csv" download>下載題目 CSV 範本</a>
            <a className="link" href="/templates/source-manifest-template.csv" download>下載原卷清單範本</a>
          </div>
          <form action={importCsvAction} className="grid gap-2">
            <input name="file" type="file" accept=".csv,text/csv" className="input" required aria-label="CSV 檔案" />
            <button className="btn btn-primary">上傳 CSV</button>
          </form>
          <details className="text-xs">
            <summary className="cursor-pointer">欄位說明</summary>
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              <li>source_type（來源類型）：BANK_EXAM、FIT_REFERENCE、DEMO（必填）</li>
              <li>bank、year、exam_name、position、paper_subject、exam_date</li>
              <li>paper_url、answer_url、announcement_url（真題缺少時會標示警示）</li>
              <li>number（題號）、subject（科目：會計學／貨幣銀行學／票據法／銀行法，空白則系統建議）、topic（主題名稱）</li>
              <li>option_style：ALPHA 或 NUMERIC；stem、option_a～option_d</li>
              <li>official_answer：A–D 或 1–4，多答以逗號分隔，送分填 *；空白＝缺少</li>
              <li>answer_status、answer_note、explanation、law_at_exam、law_recheck</li>
            </ul>
          </details>
        </section>
      </div>

      <section className="card">
        <h2 className="h2 mb-2">匯入紀錄</h2>
        {jobs.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>#</th><th>類型</th><th>檔案</th><th>時間</th><th>題數</th><th>已核對</th><th>已發布</th></tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td><Link className="link" href={`/admin/import/${j.id}`}>{j.id}</Link></td>
                    <td>{j.kind}</td>
                    <td className="break-all">{j.file_name}</td>
                    <td className="whitespace-nowrap">{j.created_at}</td>
                    <td>{j.total}</td>
                    <td>{j.verified}</td>
                    <td>{j.published}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm muted">尚無匯入紀錄。</p>
        )}
      </section>
    </div>
  );
}
