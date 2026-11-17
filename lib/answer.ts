// 答案解析與判分（純函式，不存取資料庫）
import { OPTION_KEYS, optionLabel } from "./constants";

/**
 * 官方答案儲存格式：
 * - "C"         單一答案
 * - "B,C"       一題多答（任一皆給分）
 * - "*"         送分（任何作答皆給分）
 * - "" / null   缺少答案
 */
export function parseAnswerSet(answer: string | null | undefined): Set<string> | "ALL" | null {
  if (!answer) return null;
  const a = answer.trim().toUpperCase();
  if (!a) return null;
  if (a === "*") return "ALL";
  const set = new Set(
    a
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter((s) => (OPTION_KEYS as readonly string[]).includes(s)),
  );
  return set.size ? set : null;
}

/** 正規化使用者或匯入輸入之答案；無法辨識時回傳 null（不猜測） */
export function normalizeAnswerInput(input: string | null | undefined): string | null {
  if (input == null) return null;
  let s = String(input).trim().toUpperCase();
  if (!s) return null;
  s = s.replace(/[（(）)]/g, "").replace(/[Ａ-Ｄ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (s === "*" || s === "送分" || s === "#") return "*";
  const parts = s.split(/[,，、\s\/或]+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (/^[A-D]$/.test(p)) out.push(p);
    else if (/^[1-4]$/.test(p)) out.push(OPTION_KEYS[Number(p) - 1]);
    else if (/^[A-D]{2,4}$/.test(p)) out.push(...p.split(""));
    else return null;
  }
  const uniq = [...new Set(out)].sort();
  return uniq.length ? uniq.join(",") : null;
}

/**
 * 判分：回傳 true/false；缺少可用答案時回傳 null（無法判分）。
 */
export function grade(
  chosen: string | null | undefined,
  officialAnswer: string | null | undefined,
  answerStatus: string,
): boolean | null {
  if (answerStatus === "MISSING") return null;
  const set = parseAnswerSet(officialAnswer);
  if (set === null) return null;
  if (!chosen) return false;
  if (set === "ALL") return true;
  return set.has(chosen);
}

export function formatAnswer(answer: string | null | undefined, style?: string | null): string {
  const set = parseAnswerSet(answer);
  if (set === null) return "缺少";
  if (set === "ALL") return "送分（皆給分）";
  return [...set].map((k) => optionLabel(k, style)).join(" 或 ");
}
