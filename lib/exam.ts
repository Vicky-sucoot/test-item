// 限時模擬考：抽題、建立、逾時處理
import { db } from "./db";
import { SOURCE_TYPES, type SourceType, type Subject } from "./constants";
import { EXAM_GRACE_MS, createAttempt, submitAttempt } from "./practice";
import { allocateByWeights, apportion } from "./examRatio";

export interface ExamPreset {
  key: string;
  name: string;
  subjects: Subject[];
  count: number;
  minutes: number;
}

export const EXAM_PRESETS: ExamPreset[] = [
  { key: "ACC_MB", name: "會計學＋貨幣銀行學", subjects: ["ACCOUNTING", "MONEY_BANKING"], count: 80, minutes: 90 },
  { key: "LAW", name: "票據法＋銀行法", subjects: ["NEGOTIABLE_INSTRUMENTS", "BANKING_ACT"], count: 50, minutes: 60 },
];

export { EXAM_GRACE_MS };

/** 各科平均分配題數；某科不足時由其他科補足。純函式。 */
export function allocate(count: number, available: number[]): number[] {
  return allocateByWeights(count, available.map(() => 1), available);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 某科可出題的題目編號（已發布、重複題只取一題、可選擇排除缺答案者） */
export function examPool(subject: string, sourceTypes: SourceType[], excludeMissing: boolean): number[] {
  const st = sourceTypes.length ? sourceTypes : [...SOURCE_TYPES];
  const rows = db()
    .prepare(
      `SELECT q.id, q.duplicate_group_id FROM questions q JOIN exam_papers p ON p.id = q.paper_id
       WHERE q.status='PUBLISHED' AND q.subject = ? AND p.source_type IN (${st.map(() => "?").join(",")})
       ${excludeMissing ? "AND q.answer_status != 'MISSING'" : ""}
       ORDER BY RANDOM()`,
    )
    .all(subject, ...st) as { id: number; duplicate_group_id: number | null }[];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const r of rows) {
    if (r.duplicate_group_id != null) {
      if (seen.has(r.duplicate_group_id)) continue;
      seen.add(r.duplicate_group_id);
    }
    ids.push(r.id);
  }
  return ids;
}

export interface ExamConfig {
  name: string;
  subjects: Subject[];
  count: number;
  minutes: number;
  sourceTypes: SourceType[];
  excludeMissing: boolean;
  /** 各科權重（第三階段）；未提供時平均分配 */
  weights?: number[];
  /** 比例來源說明，記錄在作答紀錄中 */
  ratioLabel?: string;
}

export interface ExamPlan {
  subjects: Subject[];
  planned: number[];
  actual: number[];
  available: number[];
  ratioLabel: string;
}

/** 計算抽題計畫：planned 為依比例應出題數，actual 為考慮題庫可用題數後的實際題數 */
export function planExam(cfg: ExamConfig): { plan: ExamPlan; pools: number[][] } {
  const pools = cfg.subjects.map((s) => examPool(s, cfg.sourceTypes, cfg.excludeMissing));
  const weights = cfg.weights ?? cfg.subjects.map(() => 1);
  const available = pools.map((p) => p.length);
  return {
    pools,
    plan: {
      subjects: cfg.subjects,
      planned: apportion(cfg.count, weights),
      actual: allocateByWeights(cfg.count, weights, available),
      available,
      ratioLabel: cfg.ratioLabel ?? "平均分配",
    },
  };
}

export function createExam(cfg: ExamConfig): { attemptId: number | null; picked: number; plan: ExamPlan } {
  const { plan, pools } = planExam(cfg);
  const ids = shuffle(pools.flatMap((p, i) => p.slice(0, plan.actual[i])));
  if (!ids.length) return { attemptId: null, picked: 0, plan };
  const limitSec = cfg.minutes * 60;
  const attemptId = createAttempt(ids, {
    mode: "EXAM",
    title: `模擬考・${cfg.name}`,
    instant: false,
    filters: JSON.stringify({ ...cfg, plan }),
  });
  db()
    .prepare("UPDATE attempts SET time_limit_sec=?, deadline_ms=? WHERE id=?")
    .run(limitSec, Date.now() + limitSec * 1000, attemptId);
  return { attemptId, picked: ids.length, plan };
}

/** 從作答紀錄取回抽題計畫（第二階段建立的考試沒有計畫，回傳 null） */
export function examPlanOf(filters: string | null): ExamPlan | null {
  if (!filters) return null;
  try {
    const f = JSON.parse(filters);
    return f.plan ?? null;
  } catch {
    return null;
  }
}

export function isExpired(a: { mode: string; deadline_ms: number | null; submitted_at: string | null }, now = Date.now()) {
  return a.mode === "EXAM" && !a.submitted_at && a.deadline_ms != null && now > a.deadline_ms + EXAM_GRACE_MS;
}

/** 將已超過時限但未交卷的模擬考自動交卷 */
export function finalizeExpiredExams(now = Date.now()) {
  const rows = db()
    .prepare("SELECT id FROM attempts WHERE mode='EXAM' AND submitted_at IS NULL AND deadline_ms IS NOT NULL AND deadline_ms + ? < ?")
    .all(EXAM_GRACE_MS, now) as { id: number }[];
  for (const r of rows) submitAttempt(r.id, "TIMEOUT");
  return rows.length;
}

export function examHistory(limit = 30) {
  return db()
    .prepare(
      `SELECT id, title, started_at, submitted_at, total, answered, gradable, correct, time_limit_sec, deadline_ms, submit_reason, filters
       FROM attempts WHERE mode='EXAM' ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as {
    id: number;
    title: string;
    started_at: string;
    submitted_at: string | null;
    total: number;
    answered: number | null;
    gradable: number | null;
    correct: number | null;
    time_limit_sec: number;
    deadline_ms: number;
    submit_reason: string | null;
    filters: string | null;
  }[];
}

/** 作答用時（秒）：時間到自動交卷者為完整時限；其餘以開始與交卷時間計算，最多為時限 */
export function usedSeconds(
  startedAt: string,
  submittedAt: string | null,
  limitSec?: number | null,
  reason?: string | null,
): number | null {
  if (!submittedAt) return null;
  if (reason === "TIMEOUT" && limitSec) return limitSec;
  const s = new Date(startedAt.replace(" ", "T")).getTime();
  const e = new Date(submittedAt.replace(" ", "T")).getTime();
  const v = Math.max(0, Math.round((e - s) / 1000));
  return limitSec ? Math.min(v, limitSec) : v;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} 分 ${String(s).padStart(2, "0")} 秒`;
}
