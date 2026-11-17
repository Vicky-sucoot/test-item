import { describe, expect, it } from "vitest";
import { formatAnswer, grade, normalizeAnswerInput } from "@/lib/answer";
import { splitQuestions } from "@/lib/import/splitQuestions";
import { parseAnswerText } from "@/lib/import/parseAnswers";
import { suggestSubject, subjectFromPaperLabel } from "@/lib/import/classify";
import { parseQuestionCsv } from "@/lib/import/csv";
import { nextWrongState } from "@/lib/wrongbook";
import { stemHash } from "@/lib/normalize";

describe("答案正規化與判分", () => {
  it("normalizes letters, numbers, multi-answers and 送分", () => {
    expect(normalizeAnswerInput("c")).toBe("C");
    expect(normalizeAnswerInput("（Ｂ）")).toBe("B");
    expect(normalizeAnswerInput("3")).toBe("C");
    expect(normalizeAnswerInput("B或C")).toBe("B,C");
    expect(normalizeAnswerInput("送分")).toBe("*");
    expect(normalizeAnswerInput("")).toBeNull();
    expect(normalizeAnswerInput("E")).toBeNull();
  });
  it("does not grade questions without answers", () => {
    expect(grade("A", null, "MISSING")).toBeNull();
    expect(grade("A", "A", "MISSING")).toBeNull();
    expect(grade("A", "", "OFFICIAL")).toBeNull();
  });
  it("grades single, multiple and 送分", () => {
    expect(grade("A", "A", "OFFICIAL")).toBe(true);
    expect(grade("B", "A", "OFFICIAL")).toBe(false);
    expect(grade("C", "B,C", "OFFICIAL_AMENDED")).toBe(true);
    expect(grade("D", "*", "OFFICIAL_AMENDED")).toBe(true);
    expect(grade(null, "A", "OFFICIAL")).toBe(false);
  });
  it("formats with numeric style", () => {
    expect(formatAnswer("C", "NUMERIC")).toBe("(3)");
    expect(formatAnswer(null)).toBe("缺少");
  });
});

describe("PDF 文字切題", () => {
  it("splits alpha-style questions across lines", () => {
    const text = `某銀行 113 年甄試 綜合科目
1. 下列何者屬於流動資產？
(A)土地 (B)應收帳款
(C)專利權 (D)機器設備
2. 簡單存款乘數為何？(A)5 (B)9 (C)10 (D)11
3.支票之付款人以何者為限？（A）金融業者（B）自然人（C）發票人（D）公司`;
    const { questions } = splitQuestions(text);
    expect(questions).toHaveLength(3);
    expect(questions[0].stem).toBe("下列何者屬於流動資產？");
    expect(questions[0].options).toEqual(["土地", "應收帳款", "專利權", "機器設備"]);
    expect(questions[2].options[0]).toBe("金融業者");
    expect(questions[1].warnings).toEqual([]);
  });
  it("handles numeric option style and inline answers", () => {
    const text = `( 3 ) 1. 實質利率約為？ (1)2% (2)5% (3)3% (4)7%
( 1 ) 2. 票據種類？ (1)匯票、本票及支票 (2)本票 (3)支票 (4)倉單`;
    const { questions } = splitQuestions(text);
    expect(questions).toHaveLength(2);
    expect(questions[0].optionStyle).toBe("NUMERIC");
    expect(questions[0].inlineAnswer).toBe("C");
    expect(questions[1].inlineAnswer).toBe("A");
  });
  it("ignores out-of-sequence numbers and decimals", () => {
    const text = `1. 利率由 3.5% 上升
5. 不是新題
(A)甲 (B)乙 (C)丙 (D)丁
2. 第二題 (A)a (B)b (C)c (D)d`;
    const { questions } = splitQuestions(text);
    expect(questions.map((q) => q.number)).toEqual([1, 2]);
    expect(questions[0].stem).toContain("5. 不是新題");
  });
  it("warns on incomplete options and empty text", () => {
    const { questions } = splitQuestions("1. 只有兩個選項 (A)a (B)b");
    expect(questions[0].warnings[0]).toContain("選項擷取不完整");
    expect(splitQuestions("").warnings[0]).toContain("未偵測到任何題目");
  });
});

describe("答案檔解析", () => {
  it("parses table form", () => {
    const r = parseAnswerText("題號 1 2 3 4\n答案 C A D B");
    expect([...r.answers]).toEqual([
      [1, "C"],
      [2, "A"],
      [3, "D"],
      [4, "B"],
    ]);
  });
  it("parses numeric table form", () => {
    const r = parseAnswerText("1 2 3\n3 1 4");
    expect(r.answers.get(1)).toBe("C");
    expect(r.answers.get(3)).toBe("D");
  });
  it("parses pairs and multi answers", () => {
    const r = parseAnswerText("1.C 2.(A) 3：B或C 4 送分");
    expect(r.answers.get(1)).toBe("C");
    expect(r.answers.get(2)).toBe("A");
    expect(r.answers.get(3)).toBe("B,C");
    expect(r.answers.get(4)).toBe("*");
  });
  it("parses letter sequences", () => {
    const r = parseAnswerText("CABD");
    expect(r.answers.get(4)).toBe("D");
  });
});

describe("科目分類建議", () => {
  it("suggests subjects by keyword and leaves ambiguity unclassified", () => {
    expect(suggestSubject("下列何者為匯票之背書效力")).toBe("NEGOTIABLE_INSTRUMENTS");
    expect(suggestSubject("依銀行法，銀行對利害關係人之授信")).toBe("BANKING_ACT");
    expect(suggestSubject("期末存貨採先進先出")).toBe("ACCOUNTING");
    expect(suggestSubject("貨幣供給與存款乘數")).toBe("MONEY_BANKING");
    expect(suggestSubject("下列敘述何者正確")).toBe("UNCLASSIFIED");
  });
  it("maps paper subject labels", () => {
    expect(subjectFromPaperLabel("會計學")).toBe("ACCOUNTING");
    expect(subjectFromPaperLabel("綜合科目（含票據法、銀行法）")).toBeNull();
    expect(subjectFromPaperLabel("貨幣銀行學")).toBe("MONEY_BANKING");
  });
});

describe("CSV 匯入", () => {
  it("maps rows, keeps missing answers missing and flags missing sources", () => {
    const csv = `source_type,bank,year,exam_name,number,subject,topic,stem,option_a,option_b,option_c,option_d,official_answer
BANK_EXAM,臺灣銀行,113,113年新進人員甄試,1,會計學,存貨,題目一,甲,乙,丙,丁,
DEMO,,,,,ACCOUNTING,,題目二,甲,乙,丙,丁,B`;
    const { rows, errors } = parseQuestionCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].answer_status).toBe("MISSING");
    expect(rows[0].warnings).toContain("缺少原卷網址");
    expect(rows[0].subject).toBe("ACCOUNTING");
    expect(rows[1].answer_status).toBe("SELF_WRITTEN");
    expect(rows[1].paper.exam_name).toBe("自編示範題");
  });
  it("accepts Chinese headers and rejects demo marked official", () => {
    const csv = `來源類型,題幹,選項A,選項B,官方答案,答案狀態
DEMO,示範,甲,乙,A,OFFICIAL`;
    const { rows } = parseQuestionCsv(csv);
    expect(rows[0].answer_status).toBe("SELF_WRITTEN");
  });
  it("reports unknown source types", () => {
    const { rows, errors } = parseQuestionCsv("source_type,stem\nXYZ,題目");
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("來源類型");
  });
});

describe("錯題本", () => {
  it("adds on wrong, becomes familiar after 2 correct, resets on wrong", () => {
    let s = nextWrongState(null, false)!;
    expect(s).toEqual({ wrong_count: 1, correct_streak: 0, status: "ACTIVE" });
    s = nextWrongState(s, true)!;
    expect(s.status).toBe("ACTIVE");
    s = nextWrongState(s, true)!;
    expect(s.status).toBe("FAMILIAR");
    s = nextWrongState(s, false)!;
    expect(s).toEqual({ wrong_count: 2, correct_streak: 0, status: "ACTIVE" });
    expect(nextWrongState(null, true)).toBeNull();
  });
});

describe("重複題雜湊", () => {
  it("ignores whitespace, width and option order", () => {
    expect(stemHash("下列何者？ ", ["甲", "乙"])).toBe(stemHash("下列何者?", ["乙", "甲"]));
    expect(stemHash("下列何者？", ["甲"])).not.toBe(stemHash("下列何者？", ["丙"]));
  });
});
