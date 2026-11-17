// 第三階段：依真實考試各科比例出題
// 比例來源只有兩種：使用者已匯入且「已與原卷核對」的銀行甄試真題統計，或使用者手動設定。
// 系統不內建、也不推測任何銀行的各科題數比例；兩者皆無時以平均分配，並明確標示。
import { db, now } from "./db";
import { subjectLabel, type Subject } from "./constants";

/** 最大餘數法：將 total 依權重分配為整數，總和恰為 total。權重全為 0 時平均分配。純函式。 */
export function apportion(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (!n || total <= 0) return new Array(n).fill(0);
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  const ws = sum > 0 ? w : new Array(n).fill(1);
  const s = ws.reduce((a, b) => a + b, 0);
  const exact = ws.map((x) => (total * x) / s);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x), w: ws[i] }))
    .sort((a, b) => b.r - a.r || b.w - a.w || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k].i]++;
  return out;
}

/**
 * 依權重分配題數並考慮各科可用題數：某科不足時，差額依權重分給仍有題目的科目；
 * 有權重的科目都用完後，才由權重為 0 的科目補足。純函式。
 */
export function allocateByWeights(count: number, weights: number[], available: number[]): number[] {
  const n = available.length;
  const out = new Array(n).fill(0);
  let remaining = Math.min(Math.max(count, 0), available.reduce((a, b) => a + b, 0));
  while (remaining > 0) {
    let spare = available.map((a, i) => (out[i] < a && (weights[i] ?? 0) > 0 ? i : -1)).filter((i) => i >= 0);
    let useEqual = false;
    if (!spare.length) {
      spare = available.map((a, i) => (out[i] < a ? i : -1)).filter((i) => i >= 0);
      useEqual = true;
    }
    const share = apportion(remaining, spare.map((i) => (useEqual ? 1 : weights[i])));
    let moved = 0;
    spare.forEach((i, k) => {
      const take = Math.min(share[k], available[i] - out[i]);
      out[i] += take;
      moved += take;
    });
    remaining -= moved;
    if (moved === 0) break; // 理論上不會發生，避免無窮迴圈
  }
  return out;
}

export type RatioMode = "AUTO" | "MANUAL" | "EVEN";
export const RATIO_MODE_LABEL: Record<RatioMode, string> = {
  AUTO: "依已核對的銀行甄試真題自動統計",
  MANUAL: "手動設定比例",
  EVEN: "平均分配",
};

export interface RatioBasis {
  bank?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
}

export interface RealRatio {
  counts: number[];
  total: number;
  papers: {
    id: number;
    bank: string | null;
    year: number | null;
    exam_name: string;
    subject_label: string | null;
    counts: Record<string, number>;
  }[];
}

/** 從已發布、已與原卷核對的銀行甄試真題統計各科題數（重複題在各試卷各算一次，因為比例描述的是試卷內容） */
export function realRatio(subjects: Subject[], basis: RatioBasis = {}): RealRatio {
  const where = [
    "p.source_type = 'BANK_EXAM'",
    "q.status = 'PUBLISHED'",
    "q.verify_status = 'VERIFIED'",
    `q.subject IN (${subjects.map(() => "?").join(",")})`,
  ];
  const params: unknown[] = [...subjects];
  if (basis.bank) (where.push("p.bank = ?"), params.push(basis.bank));
  if (basis.yearFrom) (where.push("p.year >= ?"), params.push(basis.yearFrom));
  if (basis.yearTo) (where.push("p.year <= ?"), params.push(basis.yearTo));
  const rows = db()
    .prepare(
      `SELECT p.id, p.bank, p.year, p.exam_name, p.subject_label, q.subject, COUNT(*) n
       FROM questions q JOIN exam_papers p ON p.id = q.paper_id
       WHERE ${where.join(" AND ")}
       GROUP BY p.id, q.subject ORDER BY p.year DESC, p.bank, p.id`,
    )
    .all(...params) as {
    id: number;
    bank: string | null;
    year: number | null;
    exam_name: string;
    subject_label: string | null;
    subject: string;
    n: number;
  }[];
  const papers = new Map<number, RealRatio["papers"][number]>();
  const counts = subjects.map(() => 0);
  for (const r of rows) {
    const p = papers.get(r.id) ?? { id: r.id, bank: r.bank, year: r.year, exam_name: r.exam_name, subject_label: r.subject_label, counts: {} };
    p.counts[r.subject] = r.n;
    papers.set(r.id, p);
    counts[subjects.indexOf(r.subject as Subject)] += r.n;
  }
  return { counts, total: counts.reduce((a, b) => a + b, 0), papers: [...papers.values()] };
}

export interface ExamSettings {
  preset_key: string;
  ratio_mode: RatioMode;
  manual_weights: Record<string, number>;
  basis_bank: string | null;
  basis_year_from: number | null;
  basis_year_to: number | null;
  updated_at: string | null;
}

export function getExamSettings(key: string): ExamSettings {
  const r = db().prepare("SELECT * FROM exam_settings WHERE preset_key=?").get(key) as
    | (Omit<ExamSettings, "manual_weights"> & { manual_weights: string | null })
    | undefined;
  if (!r)
    return { preset_key: key, ratio_mode: "AUTO", manual_weights: {}, basis_bank: null, basis_year_from: null, basis_year_to: null, updated_at: null };
  return { ...r, manual_weights: r.manual_weights ? JSON.parse(r.manual_weights) : {} };
}

export function saveExamSettings(s: Omit<ExamSettings, "updated_at">) {
  db()
    .prepare(
      `INSERT INTO exam_settings(preset_key, ratio_mode, manual_weights, basis_bank, basis_year_from, basis_year_to, updated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(preset_key) DO UPDATE SET ratio_mode=excluded.ratio_mode, manual_weights=excluded.manual_weights,
         basis_bank=excluded.basis_bank, basis_year_from=excluded.basis_year_from, basis_year_to=excluded.basis_year_to,
         updated_at=excluded.updated_at`,
    )
    .run(s.preset_key, s.ratio_mode, JSON.stringify(s.manual_weights), s.basis_bank, s.basis_year_from, s.basis_year_to, now());
}

export interface ResolvedRatio {
  /** 設定的模式 */
  mode: RatioMode;
  /** 實際採用的模式（AUTO／MANUAL 無資料時退回 EVEN） */
  used: RatioMode;
  weights: number[];
  label: string;
  warnings: string[];
  real?: RealRatio;
}

function basisText(b: RatioBasis): string {
  const parts: string[] = [];
  if (b.bank) parts.push(b.bank);
  if (b.yearFrom || b.yearTo) parts.push(`${b.yearFrom ?? "…"}–${b.yearTo ?? "…"} 年`);
  return parts.length ? parts.join("、") : "全部銀行與年度";
}

export function resolveRatio(subjects: Subject[], s: Pick<ExamSettings, "ratio_mode" | "manual_weights" | "basis_bank" | "basis_year_from" | "basis_year_to">): ResolvedRatio {
  const even = subjects.map(() => 1);
  const warnings: string[] = [];
  if (s.ratio_mode === "MANUAL") {
    const w = subjects.map((x) => Math.max(0, Number(s.manual_weights[x]) || 0));
    if (w.some((x) => x > 0)) {
      subjects.forEach((x, i) => w[i] === 0 && warnings.push(`${subjectLabel(x)}比例設為 0，只有其他科題目不足時才會補題`));
      return { mode: "MANUAL", used: "MANUAL", weights: w, label: `手動設定（${subjects.map((x, i) => `${subjectLabel(x)} ${w[i]}`).join("：")}）`, warnings };
    }
    return { mode: "MANUAL", used: "EVEN", weights: even, label: "手動比例未設定，暫以平均分配", warnings: ["手動比例皆為 0 或未填"] };
  }
  if (s.ratio_mode === "AUTO") {
    const basis = { bank: s.basis_bank, yearFrom: s.basis_year_from, yearTo: s.basis_year_to };
    const real = realRatio(subjects, basis);
    if (real.total > 0) {
      subjects.forEach((x, i) => real.counts[i] === 0 && warnings.push(`統計依據中沒有${subjectLabel(x)}題目（可能尚未匯入該科原卷），只有其他科不足時才會補題`));
      return {
        mode: "AUTO",
        used: "AUTO",
        weights: real.counts,
        label: `依已核對銀行甄試真題統計（${basisText(basis)}；${real.papers.length} 份試卷、${real.total} 題）`,
        warnings,
        real,
      };
    }
    return {
      mode: "AUTO",
      used: "EVEN",
      weights: even,
      label: `尚無符合條件（${basisText(basis)}）且已核對的銀行甄試真題，暫以平均分配`,
      warnings: [],
      real,
    };
  }
  return { mode: "EVEN", used: "EVEN", weights: even, label: "平均分配", warnings };
}

export function percentText(weights: number[]): string[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (sum ? `${Math.round((w / sum) * 1000) / 10}%` : "—"));
}
