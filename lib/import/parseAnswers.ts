// 解析官方答案文字（由答案 PDF 擷取或手動貼上）。純函式。
// 回傳 題號 → 答案（"A" / "B,C" / "*"）。無法辨識的部分列入 unparsed，不猜測。
import { normalizeAnswerInput } from "../answer";

export interface AnswerParseResult {
  answers: Map<number, string>;
  unparsed: string[];
}

const ANS_TOKEN = "(?:[A-Da-dＡ-Ｄ](?:\\s*[,，、\\/或]\\s*[A-Da-dＡ-Ｄ])*|送分|\\*|#)";

export function parseAnswerText(text: string): AnswerParseResult {
  const answers = new Map<number, string>();
  const unparsed: string[] = [];
  const src = text.replace(/\r\n?/g, "\n");

  // 1) 表格型：一行全是題號、下一行是同數量的答案
  const lines = src.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i + 1 < lines.length; i++) {
    const nums = lines[i].replace(/^題號[:：]?/, "").trim().split(/\s+/);
    const ans = lines[i + 1].replace(/^答案[:：]?/, "").trim().split(/\s+/);
    if (nums.length >= 2 && nums.every((n) => /^\d{1,3}$/.test(n)) && ans.length === nums.length) {
      const norm = ans.map((a) => normalizeAnswerInput(a));
      if (norm.every(Boolean)) {
        nums.forEach((n, k) => answers.set(Number(n), norm[k]!));
        i++;
      }
    }
  }
  if (answers.size) return { answers, unparsed };

  // 2) 成對型：「1.C 2.A」「1 (C)」「1：B或C」
  const pairRe = new RegExp(`(\\d{1,3})\\s*[.．:：、\\-]?\\s*[（(]?\\s*(${ANS_TOKEN})\\s*[）)]?`, "g");
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(src))) {
    const a = normalizeAnswerInput(m[2]);
    if (a) answers.set(Number(m[1]), a);
    else unparsed.push(m[0]);
  }
  if (answers.size) return { answers, unparsed };

  // 3) 連續字母型：「CADBB…」依序對應第 1 題起
  const letters = src.replace(/\s+/g, "");
  if (/^[A-Da-d]+$/.test(letters)) {
    letters
      .toUpperCase()
      .split("")
      .forEach((c, i) => answers.set(i + 1, c));
    return { answers, unparsed };
  }

  if (src.trim()) unparsed.push(src.trim().slice(0, 200));
  return { answers, unparsed };
}
