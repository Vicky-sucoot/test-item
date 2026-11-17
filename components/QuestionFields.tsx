import {
  ALL_SUBJECTS,
  ANSWER_STATUS,
  ANSWER_STATUS_LABEL,
  LAW_RECHECK,
  LAW_RECHECK_LABEL,
  SUBJECT_LABEL,
  SUBJECT_SOURCE_LABEL,
} from "@/lib/constants";
import type { Topic } from "@/lib/questions";

export interface FieldValues {
  number_in_paper: number | null;
  subject: string;
  subject_source?: string;
  topic_id: number | null;
  option_style: string;
  stem: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  official_answer: string | null;
  answer_status: string;
  answer_note: string | null;
  explanation: string | null;
  law_at_exam: string | null;
  law_recheck: string | null;
}

/** 題目欄位表單（匯入檢查與題目管理共用） */
export function QuestionFields({ v, topics, idPrefix }: { v: FieldValues; topics: Topic[]; idPrefix: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>
          <label className="label" htmlFor={id("num")}>題號</label>
          <input id={id("num")} name="number_in_paper" className="input" defaultValue={v.number_in_paper ?? ""} inputMode="numeric" />
        </div>
        <div>
          <label className="label" htmlFor={id("subject")}>
            科目{v.subject_source ? `（${SUBJECT_SOURCE_LABEL[v.subject_source] ?? v.subject_source}）` : ""}
          </label>
          <select id={id("subject")} name="subject" className="input" defaultValue={v.subject}>
            {ALL_SUBJECTS.map((s) => (
              <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("topic")}>主題</label>
          <select id={id("topic")} name="topic_id" className="input" defaultValue={v.topic_id ?? ""}>
            <option value="">（未設定）</option>
            {ALL_SUBJECTS.filter((s) => s !== "UNCLASSIFIED").map((s) => (
              <optgroup key={s} label={SUBJECT_LABEL[s]}>
                {topics
                  .filter((t) => t.subject === s)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("style")}>選項標示</label>
          <select id={id("style")} name="option_style" className="input" defaultValue={v.option_style}>
            <option value="ALPHA">(A)(B)(C)(D)</option>
            <option value="NUMERIC">(1)(2)(3)(4)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={id("stem")}>題幹</label>
        <textarea id={id("stem")} name="stem" className="input min-h-20" defaultValue={v.stem} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {(["a", "b", "c", "d"] as const).map((k, i) => (
          <div key={k}>
            <label className="label" htmlFor={id(k)}>
              選項 {v.option_style === "NUMERIC" ? `(${i + 1})` : `(${k.toUpperCase()})`}
            </label>
            <input id={id(k)} name={`option_${k}`} className="input" defaultValue={v[`option_${k}`] ?? ""} />
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <div>
          <label className="label" htmlFor={id("ans")}>官方答案（空白＝缺少；多答以逗號分隔；送分填 *）</label>
          <input id={id("ans")} name="official_answer" className="input" defaultValue={v.official_answer ?? ""} placeholder="例：C、B,C、*" />
        </div>
        <div>
          <label className="label" htmlFor={id("ans-status")}>答案狀態</label>
          <select id={id("ans-status")} name="answer_status" className="input" defaultValue={v.answer_status}>
            {ANSWER_STATUS.map((s) => (
              <option key={s} value={s}>{ANSWER_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("ans-note")}>答案備註（例：官方更正公告）</label>
          <input id={id("ans-note")} name="answer_note" className="input" defaultValue={v.answer_note ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={id("expl")}>解析（新增或修改後為「待審核」）</label>
        <textarea id={id("expl")} name="explanation" className="input min-h-16" defaultValue={v.explanation ?? ""} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <label className="label" htmlFor={id("law")}>考試當時適用法規（票據法、銀行法題目必填，例：銀行法 ○年○月○日修正版）</label>
          <input id={id("law")} name="law_at_exam" className="input" defaultValue={v.law_at_exam ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor={id("recheck")}>目前法規是否需重新核對</label>
          <select id={id("recheck")} name="law_recheck" className="input" defaultValue={v.law_recheck ?? ""}>
            <option value="">（非法規題／未填）</option>
            {LAW_RECHECK.map((s) => (
              <option key={s} value={s}>{LAW_RECHECK_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
