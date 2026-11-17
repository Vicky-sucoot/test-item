// CSV 題目匯入：欄位對應（純函式）
import Papa from "papaparse";
import { normalizeAnswerInput } from "../answer";
import { ALL_SUBJECTS, SOURCE_TYPES, SUBJECT_LABEL, type SourceType, type Subject } from "../constants";
import { suggestSubject } from "./classify";

export const CSV_COLUMNS = [
  "source_type",
  "bank",
  "year",
  "exam_name",
  "position",
  "paper_subject",
  "exam_date",
  "paper_url",
  "answer_url",
  "announcement_url",
  "number",
  "subject",
  "topic",
  "option_style",
  "stem",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "official_answer",
  "answer_status",
  "answer_note",
  "explanation",
  "law_at_exam",
  "law_recheck",
] as const;

/** 中文欄名別名 */
const ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  來源類型: "source_type",
  銀行: "bank",
  年度: "year",
  甄試名稱: "exam_name",
  職缺: "position",
  原卷科目: "paper_subject",
  考試日期: "exam_date",
  原卷網址: "paper_url",
  答案網址: "answer_url",
  公告網址: "announcement_url",
  題號: "number",
  科目: "subject",
  主題: "topic",
  選項樣式: "option_style",
  題幹: "stem",
  選項A: "option_a",
  選項B: "option_b",
  選項C: "option_c",
  選項D: "option_d",
  官方答案: "official_answer",
  答案狀態: "answer_status",
  答案備註: "answer_note",
  解析: "explanation",
  考試當時適用法規: "law_at_exam",
  目前法規核對: "law_recheck",
};

export interface PaperMeta {
  source_type: SourceType;
  bank: string | null;
  year: number | null;
  exam_name: string;
  position: string | null;
  subject_label: string | null;
  exam_date: string | null;
  paper_url: string | null;
  answer_url: string | null;
  announcement_url: string | null;
}

export interface ImportRow {
  paper: PaperMeta;
  number: number | null;
  subject: Subject;
  subject_source: "MANUAL" | "AUTO";
  topic_name: string | null;
  option_style: "ALPHA" | "NUMERIC";
  stem: string;
  options: [string, string, string, string];
  official_answer: string | null;
  answer_status: string;
  answer_note: string | null;
  explanation: string | null;
  law_at_exam: string | null;
  law_recheck: string | null;
  warnings: string[];
  raw: string;
}

const SUBJECT_BY_LABEL: Record<string, Subject> = Object.fromEntries(
  Object.entries(SUBJECT_LABEL).map(([k, v]) => [v, k as Subject]),
);

function mapSubject(v: string): Subject | null {
  const t = v.trim();
  if (!t) return null;
  if ((ALL_SUBJECTS as string[]).includes(t.toUpperCase())) return t.toUpperCase() as Subject;
  return SUBJECT_BY_LABEL[t] ?? null;
}

function mapSourceType(v: string): SourceType | null {
  const t = v.trim().toUpperCase();
  if ((SOURCE_TYPES as readonly string[]).includes(t)) return t as SourceType;
  if (v.includes("示範")) return "DEMO";
  if (v.toUpperCase().includes("FIT")) return "FIT_REFERENCE";
  if (v.includes("甄試")) return "BANK_EXAM";
  return null;
}

/** 推定答案狀態：示範題→自編；有答案→官方；無答案→缺少 */
export function defaultAnswerStatus(sourceType: SourceType, answer: string | null): string {
  if (sourceType === "DEMO") return answer ? "SELF_WRITTEN" : "MISSING";
  return answer ? "OFFICIAL" : "MISSING";
}

export function parseQuestionCsv(text: string): { rows: ImportRow[]; errors: string[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => {
      const t = h.trim();
      return ALIASES[t] ?? t.toLowerCase();
    },
  });
  const errors = res.errors.map((e) => `第 ${(e.row ?? 0) + 2} 行：${e.message}`);
  const rows: ImportRow[] = [];
  res.data.forEach((r, i) => {
    const line = i + 2;
    const g = (k: (typeof CSV_COLUMNS)[number]) => (r[k] ?? "").toString().trim();
    const warnings: string[] = [];
    const st = mapSourceType(g("source_type"));
    if (!st) {
      errors.push(`第 ${line} 行：來源類型無法辨識（需為 BANK_EXAM / FIT_REFERENCE / DEMO）`);
      return;
    }
    const stem = g("stem");
    if (!stem) {
      errors.push(`第 ${line} 行：缺少題幹`);
      return;
    }
    const yearNum = g("year") ? Number(g("year")) : null;
    if (g("year") && !Number.isInteger(yearNum)) warnings.push("年度格式錯誤，已留空");
    const paper: PaperMeta = {
      source_type: st,
      bank: g("bank") || null,
      year: Number.isInteger(yearNum) ? yearNum : null,
      exam_name: g("exam_name") || (st === "DEMO" ? "自編示範題" : ""),
      position: g("position") || null,
      subject_label: g("paper_subject") || null,
      exam_date: g("exam_date") || null,
      paper_url: g("paper_url") || null,
      answer_url: g("answer_url") || null,
      announcement_url: g("announcement_url") || null,
    };
    if (st !== "DEMO") {
      if (!paper.paper_url) warnings.push("缺少原卷網址");
      if (!paper.year) warnings.push("缺少年度");
      if (!paper.exam_name) warnings.push("缺少甄試名稱");
      if (st === "BANK_EXAM" && !paper.bank) warnings.push("缺少銀行");
    }
    let subject = mapSubject(g("subject"));
    let subject_source: "MANUAL" | "AUTO" = "MANUAL";
    if (!subject) {
      subject = suggestSubject(stem + g("option_a") + g("option_b") + g("option_c") + g("option_d"));
      subject_source = "AUTO";
      warnings.push(subject === "UNCLASSIFIED" ? "科目待人工分類" : "科目為系統建議，請確認");
    }
    const rawAns = g("official_answer");
    const ans = normalizeAnswerInput(rawAns);
    if (rawAns && !ans) warnings.push(`答案「${rawAns}」無法辨識，已留空`);
    let answer_status = g("answer_status").toUpperCase() || defaultAnswerStatus(st, ans);
    if (!ans) answer_status = "MISSING";
    if (st === "DEMO" && answer_status === "OFFICIAL") {
      answer_status = "SELF_WRITTEN";
      warnings.push("示範題不可標為官方答案，已改為自編參考答案");
    }
    if (answer_status === "MISSING") warnings.push("缺少官方答案");
    const numRaw = g("number");
    const number = numRaw && /^\d+$/.test(numRaw) ? Number(numRaw) : null;
    if (st !== "DEMO" && number == null) warnings.push("缺少題號");
    const options: [string, string, string, string] = [g("option_a"), g("option_b"), g("option_c"), g("option_d")];
    if (options.filter(Boolean).length < 2) warnings.push("選項少於 2 個");
    rows.push({
      paper,
      number,
      subject,
      subject_source,
      topic_name: g("topic") || null,
      option_style: g("option_style").toUpperCase() === "NUMERIC" ? "NUMERIC" : "ALPHA",
      stem,
      options,
      official_answer: ans,
      answer_status,
      answer_note: g("answer_note") || null,
      explanation: g("explanation") || null,
      law_at_exam: g("law_at_exam") || null,
      law_recheck: g("law_recheck") || null,
      warnings,
      raw: JSON.stringify(r),
    });
  });
  return { rows, errors };
}
