import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listQuestions, parseFilters, selectQuestionIds, getDuplicates, getQuestion, toggleBookmark } from "@/lib/questions";
import { createAttempt, saveAnswer, submitAttempt, getAttempt } from "@/lib/practice";
import { createCsvJob, getJobItems, publishJob, updateItem, applyAnswerText } from "@/lib/import/service";
import { subjectStats } from "@/lib/stats";
import { DEMO_QUESTIONS } from "@/lib/seed";

describe("資料庫流程（記憶體資料庫）", () => {
  it("seeds demo questions, all labelled DEMO and never OFFICIAL", () => {
    const rows = db().prepare("SELECT q.answer_status, p.source_type FROM questions q JOIN exam_papers p ON p.id=q.paper_id").all() as { answer_status: string; source_type: string }[];
    expect(rows.length).toBe(DEMO_QUESTIONS.length + 2);
    expect(rows.every((r) => r.source_type === "DEMO")).toBe(true);
    expect(rows.some((r) => r.answer_status.startsWith("OFFICIAL"))).toBe(false);
  });

  it("filters by subject and dedupes duplicate groups", () => {
    const all = listQuestions(parseFilters({ subject: "MONEY_BANKING" }));
    const dedup = listQuestions(parseFilters({ subject: "MONEY_BANKING", dedupe: "1" }));
    expect(all.total).toBe(6);
    expect(dedup.total).toBe(5);
    const dupRow = all.rows.find((r) => r.dup_count > 1)!;
    expect(getDuplicates(dupRow)).toHaveLength(1);
  });

  it("runs a practice attempt, grades and updates the wrong book", () => {
    const ids = selectQuestionIds(parseFilters({ subject: "ACCOUNTING" }), 100, "seq");
    const id = createAttempt(ids, { mode: "PRACTICE", title: "t", instant: false });
    // 全部選 D：只有缺少答案那題無法判分
    ids.forEach((_, i) => saveAnswer(id, i + 1, "D"));
    submitAttempt(id);
    const a = getAttempt(id)!;
    expect(a.answered).toBe(ids.length);
    expect(a.gradable).toBe(ids.length - 1);
    expect(a.correct).toBe(0);
    const wrong = listQuestions(parseFilters({ only: "wrong" }));
    expect(wrong.total).toBe(ids.length - 1);
    // 再答對兩次 → 已熟悉
    const q1 = ids[0];
    const ans = getQuestion(q1)!.official_answer!;
    for (let k = 0; k < 2; k++) {
      const t = createAttempt([q1], { mode: "RETRY_WRONG", title: "r", instant: true });
      expect(saveAnswer(t, 1, ans)).toEqual({ revealed: true, isCorrect: true });
      expect(() => saveAnswer(t, 1, "A")).toThrow();
      submitAttempt(t);
    }
    expect(getQuestion(q1)!.wrong_status).toBe("FAMILIAR");
    const s = subjectStats().find((x) => x.subject === "ACCOUNTING")!;
    expect(s.correct).toBe(2);
    expect(s.ungradable).toBe(1);
  });

  it("toggles bookmarks", () => {
    expect(toggleBookmark(1)).toBe(true);
    expect(listQuestions(parseFilters({ only: "bookmark" })).total).toBe(1);
    expect(toggleBookmark(1)).toBe(false);
  });

  it("imports CSV, requires verification, publishes and detects duplicates", () => {
    const stem = DEMO_QUESTIONS[0].stem;
    const o = DEMO_QUESTIONS[0].options;
    const csv = `source_type,exam_name,number,subject,stem,option_a,option_b,option_c,option_d,official_answer
DEMO,CSV 示範,1,會計學,${stem},${o.join(",")},
DEMO,CSV 示範,2,,下列敘述何者正確,甲,乙,丙,丁,`;
    const { jobId } = createCsvJob("t.csv", csv);
    expect(jobId).not.toBeNull();
    let items = getJobItems(jobId!);
    expect(items[1].subject).toBe("UNCLASSIFIED");
    // 未核對不發布
    expect(publishJob(jobId!).published).toBe(0);
    // 套用答案
    expect(applyAnswerText(jobId!, "1.B", "DEMO").updated).toBe(1);
    items = getJobItems(jobId!);
    expect(items[0].answer_status).toBe("SELF_WRITTEN");
    const base = (i: (typeof items)[number]) => ({ ...i, verified: true });
    expect(updateItem(items[0].id, base(items[0]))).toEqual([]);
    // 第二題：示範題不可標為官方答案
    expect(updateItem(items[1].id, { ...base(items[1]), official_answer: "A", answer_status: "OFFICIAL" })).toContain("示範題不可標為官方答案");
    const r = publishJob(jobId!);
    expect(r.published).toBe(1);
    expect(r.duplicates).toBe(1);
    const q = getQuestion(getJobItems(jobId!)[0].published_question_id!)!;
    expect(q.dup_count).toBe(2);
  });
});
