import { db, now } from "./db";
import { grade } from "./answer";
import { nextWrongState, type WrongState } from "./wrongbook";

/** 模擬考交卷寬限（毫秒）：網路延遲時，截止後短時間內的作答仍接受 */
export const EXAM_GRACE_MS = 5000;

export interface Attempt {
  id: number;
  mode: string;
  title: string | null;
  instant_feedback: number;
  filters: string | null;
  started_at: string;
  submitted_at: string | null;
  total: number | null;
  answered: number | null;
  gradable: number | null;
  correct: number | null;
  time_limit_sec: number | null;
  deadline_ms: number | null;
  submit_reason: string | null;
}

export interface AttemptItem {
  attempt_id: number;
  seq: number;
  question_id: number;
  chosen: string | null;
  is_correct: number | null;
  answered_at: string | null;
}

export function createAttempt(
  questionIds: number[],
  opts: { mode: string; title: string; instant: boolean; filters?: string },
): number {
  const d = db();
  return d.transaction(() => {
    const id = Number(
      d
        .prepare("INSERT INTO attempts(mode, title, instant_feedback, filters, total) VALUES (?,?,?,?,?)")
        .run(opts.mode, opts.title, opts.instant ? 1 : 0, opts.filters ?? null, questionIds.length).lastInsertRowid,
    );
    const ins = d.prepare("INSERT INTO attempt_items(attempt_id, seq, question_id) VALUES (?,?,?)");
    questionIds.forEach((qid, i) => ins.run(id, i + 1, qid));
    return id;
  })();
}

export function getAttempt(id: number): Attempt | undefined {
  return db().prepare("SELECT * FROM attempts WHERE id=?").get(id) as Attempt | undefined;
}

export function getAttemptItems(id: number): AttemptItem[] {
  return db().prepare("SELECT * FROM attempt_items WHERE attempt_id=? ORDER BY seq").all(id) as AttemptItem[];
}

function questionAnswer(qid: number) {
  return db().prepare("SELECT official_answer, answer_status FROM questions WHERE id=?").get(qid) as
    | { official_answer: string | null; answer_status: string }
    | undefined;
}

/** 儲存作答；即時回饋模式下回傳判分結果並鎖定該題 */
export function saveAnswer(attemptId: number, seq: number, choice: string | null) {
  const d = db();
  const a = getAttempt(attemptId);
  if (!a || a.submitted_at) throw new Error("此次練習已交卷，無法再修改作答");
  if (a.mode === "EXAM" && a.deadline_ms != null && Date.now() > a.deadline_ms + EXAM_GRACE_MS)
    throw new Error("模擬考時間已到，無法再作答");
  const item = d.prepare("SELECT * FROM attempt_items WHERE attempt_id=? AND seq=?").get(attemptId, seq) as
    | AttemptItem
    | undefined;
  if (!item) throw new Error("找不到題目");
  if (a.instant_feedback && item.chosen) {
    throw new Error("即時回饋模式下，已作答題目不可更改");
  }
  if (choice !== null && !["A", "B", "C", "D"].includes(choice)) throw new Error("選項不正確");
  d.prepare("UPDATE attempt_items SET chosen=?, answered_at=? WHERE attempt_id=? AND seq=?").run(
    choice,
    choice ? now() : null,
    attemptId,
    seq,
  );
  if (a.instant_feedback && choice) {
    const q = questionAnswer(item.question_id);
    return { revealed: true as const, isCorrect: q ? grade(choice, q.official_answer, q.answer_status) : null };
  }
  return { revealed: false as const };
}

export function applyWrongBook(questionId: number, isCorrect: boolean, at: string) {
  const d = db();
  const prev = d
    .prepare("SELECT wrong_count, correct_streak, status FROM wrong_book WHERE question_id=?")
    .get(questionId) as WrongState | undefined;
  const next = nextWrongState(prev ?? null, isCorrect);
  if (!next) return;
  if (!prev) {
    d.prepare(
      "INSERT INTO wrong_book(question_id, wrong_count, correct_streak, status, first_wrong_at, last_attempt_at) VALUES (?,?,?,?,?,?)",
    ).run(questionId, next.wrong_count, next.correct_streak, next.status, at, at);
  } else {
    d.prepare(
      `UPDATE wrong_book SET wrong_count=?, correct_streak=?, status=?, last_attempt_at=?,
         familiar_at = CASE WHEN ?='FAMILIAR' AND status!='FAMILIAR' THEN ? WHEN ?='ACTIVE' THEN NULL ELSE familiar_at END
       WHERE question_id=?`,
    ).run(next.wrong_count, next.correct_streak, next.status, at, next.status, at, next.status, questionId);
  }
}

export function submitAttempt(attemptId: number, reason: "MANUAL" | "TIMEOUT" = "MANUAL") {
  const d = db();
  d.transaction(() => {
    const a = getAttempt(attemptId);
    if (!a) throw new Error("找不到此次練習");
    if (a.submitted_at) return;
    const at = now();
    const items = getAttemptItems(attemptId);
    let answered = 0,
      gradable = 0,
      correct = 0;
    const upd = d.prepare("UPDATE attempt_items SET is_correct=? WHERE attempt_id=? AND seq=?");
    for (const it of items) {
      const q = questionAnswer(it.question_id);
      if (!q) continue;
      if (it.chosen) answered++;
      let g = it.chosen ? grade(it.chosen, q.official_answer, q.answer_status) : null;
      // 模擬考：未作答且有答案之題目計為答錯（但不加入錯題本）
      const unansweredInExam = a.mode === "EXAM" && !it.chosen && grade("A", q.official_answer, q.answer_status) !== null;
      if (unansweredInExam) g = false;
      upd.run(g === null ? null : g ? 1 : 0, attemptId, it.seq);
      if (g !== null) {
        gradable++;
        if (g) correct++;
        if (!unansweredInExam) applyWrongBook(it.question_id, g, at);
      }
    }
    d.prepare("UPDATE attempts SET submitted_at=?, answered=?, gradable=?, correct=?, submit_reason=? WHERE id=?").run(
      at,
      answered,
      gradable,
      correct,
      a.mode === "EXAM" ? reason : null,
      attemptId,
    );
  })();
}

export function setWrongStatus(questionId: number, status: "ACTIVE" | "FAMILIAR") {
  db()
    .prepare(
      `UPDATE wrong_book SET status=?, correct_streak = CASE WHEN ?='ACTIVE' THEN 0 ELSE correct_streak END,
       familiar_at = CASE WHEN ?='FAMILIAR' THEN COALESCE(familiar_at, ?) ELSE NULL END WHERE question_id=?`,
    )
    .run(status, status, status, now(), questionId);
}
