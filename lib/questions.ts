import { db } from "./db";
import { SOURCE_TYPES, type SourceType } from "./constants";

export interface Filters {
  sourceTypes: SourceType[];
  bank?: string;
  year?: number;
  exam?: string;
  subject?: string;
  topicId?: number;
  only?: "" | "wrong" | "familiar" | "wrongall" | "bookmark";
  dedupe?: boolean;
  q?: string;
}

export interface QuestionRow {
  id: number;
  paper_id: number;
  number_in_paper: number | null;
  subject: string;
  subject_source: string;
  topic_id: number | null;
  topic_name: string | null;
  option_style: string;
  stem: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  official_answer: string | null;
  answer_status: string;
  answer_note: string | null;
  verify_status: string;
  verified_at: string | null;
  explanation: string | null;
  explanation_status: string;
  explanation_reviewed_at: string | null;
  duplicate_group_id: number | null;
  status: string;
  law_at_exam: string | null;
  law_recheck: string | null;
  law_recheck_date: string | null;
  updated_at: string;
  // 試卷
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
  // 衍生
  dup_count: number;
  bookmarked: number;
  wrong_status: string | null;
}

export const QUESTION_SELECT = `
SELECT q.*, t.name AS topic_name,
  p.source_type, p.bank, p.year, p.exam_name, p.position, p.subject_label, p.exam_date,
  p.paper_url, p.answer_url, p.announcement_url,
  (SELECT COUNT(*) FROM questions q2 WHERE q.duplicate_group_id IS NOT NULL AND q2.duplicate_group_id = q.duplicate_group_id) AS dup_count,
  EXISTS(SELECT 1 FROM bookmarks b WHERE b.question_id = q.id) AS bookmarked,
  (SELECT w.status FROM wrong_book w WHERE w.question_id = q.id) AS wrong_status
FROM questions q
JOIN exam_papers p ON p.id = q.paper_id
LEFT JOIN topics t ON t.id = q.topic_id
`;

export function parseFilters(sp: Record<string, string | string[] | undefined> | FormData): Filters {
  const get = (k: string): string | undefined => {
    if (sp instanceof FormData) return (sp.get(k) as string | null) ?? undefined;
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const getAll = (k: string): string[] => {
    if (sp instanceof FormData) return sp.getAll(k) as string[];
    const v = sp[k];
    return v == null ? [] : Array.isArray(v) ? v : [v];
  };
  const st = getAll("src").filter((s): s is SourceType => (SOURCE_TYPES as readonly string[]).includes(s));
  const num = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  const only = get("only");
  return {
    sourceTypes: st.length ? st : [...SOURCE_TYPES],
    bank: get("bank") || undefined,
    year: num(get("year")),
    exam: get("exam") || undefined,
    subject: get("subject") || undefined,
    topicId: num(get("topic")),
    only: (["wrong", "familiar", "wrongall", "bookmark"].includes(only ?? "") ? only : "") as Filters["only"],
    dedupe: get("dedupe") === "1",
    q: get("q")?.trim() || undefined,
  };
}

export function filtersToQuery(f: Filters): string {
  const u = new URLSearchParams();
  if (f.sourceTypes.length !== SOURCE_TYPES.length) f.sourceTypes.forEach((s) => u.append("src", s));
  if (f.bank) u.set("bank", f.bank);
  if (f.year) u.set("year", String(f.year));
  if (f.exam) u.set("exam", f.exam);
  if (f.subject) u.set("subject", f.subject);
  if (f.topicId) u.set("topic", String(f.topicId));
  if (f.only) u.set("only", f.only);
  if (f.dedupe) u.set("dedupe", "1");
  if (f.q) u.set("q", f.q);
  return u.toString();
}

function buildWhere(f: Filters): { where: string; params: unknown[] } {
  const w: string[] = ["q.status = 'PUBLISHED'"];
  const params: unknown[] = [];
  if (f.sourceTypes.length) {
    w.push(`p.source_type IN (${f.sourceTypes.map(() => "?").join(",")})`);
    params.push(...f.sourceTypes);
  }
  if (f.bank) (w.push("p.bank = ?"), params.push(f.bank));
  if (f.year) (w.push("p.year = ?"), params.push(f.year));
  if (f.exam) (w.push("p.exam_name = ?"), params.push(f.exam));
  if (f.subject) (w.push("q.subject = ?"), params.push(f.subject));
  if (f.topicId) (w.push("q.topic_id = ?"), params.push(f.topicId));
  if (f.only === "wrong") w.push("EXISTS(SELECT 1 FROM wrong_book w WHERE w.question_id=q.id AND w.status='ACTIVE')");
  if (f.only === "familiar") w.push("EXISTS(SELECT 1 FROM wrong_book w WHERE w.question_id=q.id AND w.status='FAMILIAR')");
  if (f.only === "wrongall") w.push("EXISTS(SELECT 1 FROM wrong_book w WHERE w.question_id=q.id)");
  if (f.only === "bookmark") w.push("EXISTS(SELECT 1 FROM bookmarks b WHERE b.question_id=q.id)");
  if (f.q) {
    w.push("(q.stem LIKE ? OR q.option_a LIKE ? OR q.option_b LIKE ? OR q.option_c LIKE ? OR q.option_d LIKE ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like, like, like);
  }
  if (f.dedupe) {
    // 同一重複群組只取 id 最小、且同樣符合篩選條件者
    w.push(`(q.duplicate_group_id IS NULL OR q.id = (
      SELECT MIN(qx.id) FROM questions qx JOIN exam_papers px ON px.id = qx.paper_id
      WHERE qx.duplicate_group_id = q.duplicate_group_id AND qx.status='PUBLISHED'
      ${f.sourceTypes.length ? `AND px.source_type IN (${f.sourceTypes.map(() => "?").join(",")})` : ""}))`);
    params.push(...f.sourceTypes);
  }
  return { where: w.join(" AND "), params };
}

export function listQuestions(f: Filters, limit = 50, offset = 0): { rows: QuestionRow[]; total: number } {
  const { where, params } = buildWhere(f);
  const total = (
    db()
      .prepare(`SELECT COUNT(*) n FROM questions q JOIN exam_papers p ON p.id=q.paper_id WHERE ${where}`)
      .get(...params) as { n: number }
  ).n;
  const rows = db()
    .prepare(
      `${QUESTION_SELECT} WHERE ${where} ORDER BY p.year DESC NULLS LAST, p.id, q.number_in_paper, q.id LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as QuestionRow[];
  return { rows, total };
}

export function selectQuestionIds(f: Filters, limit: number, order: "random" | "seq"): number[] {
  const { where, params } = buildWhere(f);
  const orderBy = order === "random" ? "RANDOM()" : "p.year DESC NULLS LAST, p.id, q.number_in_paper, q.id";
  const rows = db()
    .prepare(
      `SELECT q.id FROM questions q JOIN exam_papers p ON p.id=q.paper_id WHERE ${where} ORDER BY ${orderBy} LIMIT ?`,
    )
    .all(...params, limit) as { id: number }[];
  return rows.map((r) => r.id);
}

export function getQuestion(id: number): QuestionRow | undefined {
  return db().prepare(`${QUESTION_SELECT} WHERE q.id = ?`).get(id) as QuestionRow | undefined;
}

export function getQuestionsByIds(ids: number[]): Map<number, QuestionRow> {
  if (!ids.length) return new Map();
  const rows = db()
    .prepare(`${QUESTION_SELECT} WHERE q.id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as QuestionRow[];
  return new Map(rows.map((r) => [r.id, r]));
}

export interface Citation {
  id: number;
  question_id: number;
  law_name: string;
  article_no: string;
  version_note: string | null;
  checked_on: string | null;
  checked_source_url: string | null;
}

export function getCitations(questionIds: number[]): Map<number, Citation[]> {
  const m = new Map<number, Citation[]>();
  if (!questionIds.length) return m;
  const rows = db()
    .prepare(`SELECT * FROM law_citations WHERE question_id IN (${questionIds.map(() => "?").join(",")}) ORDER BY id`)
    .all(...questionIds) as Citation[];
  for (const r of rows) m.set(r.question_id, [...(m.get(r.question_id) ?? []), r]);
  return m;
}

export interface DuplicateRef {
  id: number;
  number_in_paper: number | null;
  source_type: SourceType;
  bank: string | null;
  year: number | null;
  exam_name: string;
  paper_url: string | null;
  official_answer: string | null;
  answer_status: string;
  option_style: string;
  status: string;
}

export function getDuplicates(q: { id: number; duplicate_group_id: number | null }): DuplicateRef[] {
  if (!q.duplicate_group_id) return [];
  return db()
    .prepare(
      `SELECT q.id, q.number_in_paper, q.official_answer, q.answer_status, q.option_style, q.status,
              p.source_type, p.bank, p.year, p.exam_name, p.paper_url
       FROM questions q JOIN exam_papers p ON p.id=q.paper_id
       WHERE q.duplicate_group_id = ? AND q.id != ? ORDER BY p.year, q.id`,
    )
    .all(q.duplicate_group_id, q.id) as DuplicateRef[];
}

export function getFilterOptions() {
  const d = db();
  const years = (
    d.prepare("SELECT DISTINCT year FROM exam_papers WHERE year IS NOT NULL ORDER BY year DESC").all() as { year: number }[]
  ).map((r) => r.year);
  const exams = (
    d.prepare("SELECT DISTINCT exam_name FROM exam_papers ORDER BY exam_name").all() as { exam_name: string }[]
  ).map((r) => r.exam_name);
  return { years, exams };
}

export interface Topic {
  id: number;
  subject: string;
  name: string;
  sort: number;
}

export function getTopics(): Topic[] {
  return db().prepare("SELECT * FROM topics ORDER BY subject, sort, id").all() as Topic[];
}

export function toggleBookmark(questionId: number): boolean {
  const d = db();
  const exists = d.prepare("SELECT 1 FROM bookmarks WHERE question_id=?").get(questionId);
  if (exists) {
    d.prepare("DELETE FROM bookmarks WHERE question_id=?").run(questionId);
    return false;
  }
  d.prepare("INSERT INTO bookmarks(question_id) VALUES (?)").run(questionId);
  return true;
}

export function questionHistory(questionId: number) {
  return db()
    .prepare(
      `SELECT a.id attempt_id, a.submitted_at, ai.chosen, ai.is_correct
       FROM attempt_items ai JOIN attempts a ON a.id = ai.attempt_id
       WHERE ai.question_id = ? AND a.submitted_at IS NOT NULL ORDER BY a.submitted_at DESC LIMIT 30`,
    )
    .all(questionId) as { attempt_id: number; submitted_at: string; chosen: string | null; is_correct: number | null }[];
}

export function wrongEntry(questionId: number) {
  return db().prepare("SELECT * FROM wrong_book WHERE question_id=?").get(questionId) as
    | {
        wrong_count: number;
        correct_streak: number;
        status: string;
        first_wrong_at: string;
        last_attempt_at: string;
        familiar_at: string | null;
      }
    | undefined;
}
