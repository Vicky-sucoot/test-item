// 將 PDF 擷取出的純文字切分為單選題（純函式）
// 只做「擷取」，所有結果都必須經人工核對才能發布。
import { normalizeAnswerInput } from "../answer";

export type OptionStyle = "ALPHA" | "NUMERIC";

export interface ParsedQuestion {
  number: number;
  stem: string;
  options: [string, string, string, string];
  optionStyle: OptionStyle;
  /** 若原卷題號旁印有答案（例如「( C ) 1.」），擷取之；否則 null */
  inlineAnswer: string | null;
  raw: string;
  warnings: string[];
}

// 題號行：可選的「(答案)」或「(  )」，接題號與「.」「．」「、」
const START_RE =
  /^\s*(?:[（(]\s*([A-Da-d1-4]?)\s*[）)]\s*)?(\d{1,3})\s*[.．、](?!\d)\s*(?:[（(]\s*([A-Da-d]?)\s*[）)]\s*)?/;

const ALPHA_MARKERS = ["A", "B", "C", "D"].map(
  (k) => new RegExp(`[（(]\\s*[${k}${String.fromCharCode(k.charCodeAt(0) + 0xfee0)}]\\s*[）)]`, "g"),
);
const NUMERIC_MARKERS = ["1", "2", "3", "4"].map(
  (k, i) => new RegExp(`(?:[（(]\\s*[${k}${String.fromCharCode(k.charCodeAt(0) + 0xfee0)}]\\s*[）)]|${"①②③④"[i]})`, "g"),
);

function clean(s: string): string {
  return s.replace(/[ \t　]+/g, " ").replace(/\s*\n\s*/g, "").trim();
}

function findMarkers(text: string, markers: RegExp[]): { idx: number; len: number }[] | null {
  const found: { idx: number; len: number }[] = [];
  let from = 0;
  for (const m of markers) {
    m.lastIndex = from;
    const r = m.exec(text);
    if (!r) return found.length ? found : null;
    found.push({ idx: r.index, len: r[0].length });
    from = r.index + r[0].length;
  }
  return found;
}

function countMatches(text: string, markers: RegExp[]): number {
  return markers.reduce((n, m) => n + (text.match(new RegExp(m.source, "g"))?.length ?? 0), 0);
}

export function parseBlock(number: number, block: string, inline: string | null): ParsedQuestion {
  const warnings: string[] = [];
  const firstAlpha = findMarkers(block, ALPHA_MARKERS.slice(0, 1));
  const firstNum = findMarkers(block, NUMERIC_MARKERS.slice(0, 1));
  let style: OptionStyle = "ALPHA";
  if (!firstAlpha && firstNum) style = "NUMERIC";
  else if (firstAlpha && firstNum && firstNum[0].idx < firstAlpha[0].idx) {
    // 題幹中可能有 (1)(2) 敘述，若同時有 (A) 選項，優先以 (A) 為選項
    style = "ALPHA";
  }
  const markers = style === "ALPHA" ? ALPHA_MARKERS : NUMERIC_MARKERS;
  const found = findMarkers(block, markers) ?? [];
  const options: [string, string, string, string] = ["", "", "", ""];
  let stem = block;
  if (found.length) {
    stem = block.slice(0, found[0].idx);
    for (let i = 0; i < found.length; i++) {
      const start = found[i].idx + found[i].len;
      const end = i + 1 < found.length ? found[i + 1].idx : block.length;
      options[i] = clean(block.slice(start, end));
    }
  }
  if (found.length < 4) warnings.push(`選項擷取不完整（找到 ${found.length} 個）`);
  if (countMatches(block, markers) > 4) warnings.push("選項標記超過 4 個，可能誤切，請核對");
  stem = clean(stem);
  if (!stem) warnings.push("題幹為空");
  if (options.some((o, i) => i < found.length && !o)) warnings.push("有空白選項");

  let inlineAnswer: string | null = null;
  if (inline) {
    inlineAnswer = normalizeAnswerInput(inline);
    if (inlineAnswer) warnings.push("答案由原卷題號旁擷取，請與官方答案核對");
  }
  return { number, stem, options, optionStyle: style, inlineAnswer, raw: block.trim(), warnings };
}

export function splitQuestions(text: string): { questions: ParsedQuestion[]; warnings: string[] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: { number: number; inline: string | null; lines: string[] }[] = [];
  let expected = 0; // 0 表示尚未遇到第一題
  for (const line of lines) {
    const m = START_RE.exec(line);
    if (m) {
      const n = Number(m[2]);
      const ok = expected === 0 ? n >= 1 && n <= 300 : n === expected;
      if (ok) {
        const inline = (m[1] || m[3] || "").trim() || null;
        blocks.push({ number: n, inline, lines: [line.slice(m[0].length)] });
        expected = n + 1;
        continue;
      }
    }
    if (blocks.length) blocks[blocks.length - 1].lines.push(line);
  }
  const questions = blocks.map((b) => parseBlock(b.number, b.lines.join("\n"), b.inline));
  const warnings: string[] = [];
  if (!questions.length) warnings.push("未偵測到任何題目，可能為掃描影像 PDF（第一階段不支援 OCR）或格式不同，請改用 CSV 匯入。");
  return { questions, warnings };
}
