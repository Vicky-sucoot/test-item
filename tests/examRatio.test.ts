import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { allocateByWeights, apportion, getExamSettings, realRatio, resolveRatio, saveExamSettings } from "@/lib/examRatio";
import { EXAM_PRESETS, createExam, examPlanOf } from "@/lib/exam";
import { getAttempt, getAttemptItems } from "@/lib/practice";
import { getQuestion } from "@/lib/questions";
import type { Subject } from "@/lib/constants";

describe("最大餘數法分配", () => {
  it("sums exactly to the total and follows weights", () => {
    expect(apportion(80, [3, 2])).toEqual([48, 32]);
    expect(apportion(50, [1, 1])).toEqual([25, 25]);
    expect(apportion(50, [60, 40])).toEqual([30, 20]);
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(7, [0, 0])).toEqual([4, 3]); // 權重全 0 → 平均
    expect(apportion(80, [35, 45]).reduce((a, b) => a + b)).toBe(80);
    expect(apportion(0, [1, 2])).toEqual([0, 0]);
  });
});

describe("依比例並考慮題庫數量", () => {
  it("redistributes shortfalls by weight and fills from zero-weight subjects last", () => {
    expect(allocateByWeights(80, [3, 2], [100, 100])).toEqual([48, 32]);
    expect(allocateByWeights(80, [3, 2], [20, 100])).toEqual([20, 60]);
    expect(allocateByWeights(80, [1, 0], [100, 100])).toEqual([80, 0]);
    expect(allocateByWeights(80, [1, 0], [30, 100])).toEqual([30, 50]);
    expect(allocateByWeights(80, [3, 2], [5, 5])).toEqual([5, 5]);
    expect(allocateByWeights(10, [1, 1, 2], [100, 0, 100])).toEqual([3, 0, 7]);
  });
});

function addBankPaper(bank: string, year: number, counts: Partial<Record<Subject, number>>, verify = "VERIFIED") {
  const d = db();
  const pid = Number(
    d.prepare("INSERT INTO exam_papers(source_type, bank, year, exam_name, subject_label, paper_url) VALUES ('BANK_EXAM',?,?,?,?,?)")
      .run(bank, year, `${year} 年甄試（測試）`, "綜合科目", "https://example.invalid/paper.pdf").lastInsertRowid,
  );
  let n = 1;
  for (const [subject, c] of Object.entries(counts)) {
    for (let i = 0; i < (c ?? 0); i++) {
      d.prepare(
        `INSERT INTO questions(paper_id, number_in_paper, subject, stem, option_a, option_b, option_c, option_d, official_answer, answer_status, verify_status)
         VALUES (?,?,?,?,'a','b','c','d','A','OFFICIAL',?)`,
      ).run(pid, n, subject, `測試題 ${bank}${year}-${n}`, verify);
      n++;
    }
  }
}

describe("依已核對真題統計比例（記憶體資料庫）", () => {
  it("falls back to even split when there is no verified bank exam data", () => {
    const r = resolveRatio(["ACCOUNTING", "MONEY_BANKING"], getExamSettings("ACC_MB"));
    expect(r.mode).toBe("AUTO");
    expect(r.used).toBe("EVEN");
    expect(r.weights).toEqual([1, 1]);
    expect(r.label).toContain("暫以平均分配");
  });

  it("counts only verified, published BANK_EXAM questions and supports bank/year filters", () => {
    addBankPaper("臺灣銀行", 112, { ACCOUNTING: 6, MONEY_BANKING: 4, BANKING_ACT: 2 });
    addBankPaper("第一銀行", 113, { ACCOUNTING: 3, MONEY_BANKING: 7 });
    addBankPaper("第一銀行", 114, { ACCOUNTING: 9 }, "UNVERIFIED"); // 未核對不列入
    const all = realRatio(["ACCOUNTING", "MONEY_BANKING"]);
    expect(all.counts).toEqual([9, 11]);
    expect(all.papers).toHaveLength(2);
    expect(realRatio(["ACCOUNTING", "MONEY_BANKING"], { bank: "臺灣銀行" }).counts).toEqual([6, 4]);
    expect(realRatio(["ACCOUNTING", "MONEY_BANKING"], { yearFrom: 113 }).counts).toEqual([3, 7]);
    const r = resolveRatio(["ACCOUNTING", "MONEY_BANKING"], getExamSettings("ACC_MB"));
    expect(r.used).toBe("AUTO");
    expect(apportion(80, r.weights)).toEqual([36, 44]);
    expect(r.label).toContain("2 份試卷、20 題");
    // 法規科只有銀行法資料 → 票據法警示
    const law = resolveRatio(["NEGOTIABLE_INSTRUMENTS", "BANKING_ACT"], getExamSettings("LAW"));
    expect(law.weights).toEqual([0, 2]);
    expect(law.warnings[0]).toContain("票據法");
  });

  it("uses manual settings and persists them", () => {
    saveExamSettings({ preset_key: "LAW", ratio_mode: "MANUAL", manual_weights: { NEGOTIABLE_INSTRUMENTS: 20, BANKING_ACT: 30 }, basis_bank: null, basis_year_from: null, basis_year_to: null });
    const s = getExamSettings("LAW");
    expect(s.ratio_mode).toBe("MANUAL");
    const r = resolveRatio(["NEGOTIABLE_INSTRUMENTS", "BANKING_ACT"], s);
    expect(apportion(50, r.weights)).toEqual([20, 30]);
    const empty = resolveRatio(["NEGOTIABLE_INSTRUMENTS", "BANKING_ACT"], { ...s, manual_weights: {} });
    expect(empty.used).toBe("EVEN");
  });

  it("creates an exam following the ratio and records the plan", () => {
    const p = EXAM_PRESETS[0];
    const ratio = resolveRatio(p.subjects, getExamSettings(p.key)); // 9:11
    const { attemptId, plan } = createExam({ ...p, sourceTypes: ["BANK_EXAM"], excludeMissing: true, weights: ratio.weights, ratioLabel: ratio.label });
    expect(plan.planned).toEqual([36, 44]);
    expect(plan.actual).toEqual([plan.available[0], plan.available[1]]); // 題庫不足 → 全部出
    const items = getAttemptItems(attemptId!);
    const subj = items.map((i) => getQuestion(i.question_id)!.subject);
    expect(subj.filter((s) => s === "ACCOUNTING")).toHaveLength(plan.actual[0]);
    expect(examPlanOf(getAttempt(attemptId!)!.filters)!.ratioLabel).toContain("依已核對銀行甄試真題統計");
  });
});
