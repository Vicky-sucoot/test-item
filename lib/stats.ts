import { db } from "./db";

export interface SubjectStat {
  subject: string;
  question_count: number;
  answered: number;
  gradable: number;
  correct: number;
  ungradable: number;
  wrong_active: number;
  wrong_familiar: number;
  bookmarks: number;
}

export function subjectStats(): SubjectStat[] {
  return db()
    .prepare(
      `SELECT s.subject,
        (SELECT COUNT(*) FROM questions q WHERE q.subject=s.subject AND q.status='PUBLISHED') question_count,
        (SELECT COUNT(*) FROM attempt_items ai JOIN attempts a ON a.id=ai.attempt_id JOIN questions q ON q.id=ai.question_id
           WHERE a.submitted_at IS NOT NULL AND ai.chosen IS NOT NULL AND q.subject=s.subject) answered,
        (SELECT COUNT(*) FROM attempt_items ai JOIN attempts a ON a.id=ai.attempt_id JOIN questions q ON q.id=ai.question_id
           WHERE a.submitted_at IS NOT NULL AND ai.is_correct IS NOT NULL AND q.subject=s.subject) gradable,
        (SELECT COUNT(*) FROM attempt_items ai JOIN attempts a ON a.id=ai.attempt_id JOIN questions q ON q.id=ai.question_id
           WHERE a.submitted_at IS NOT NULL AND ai.is_correct = 1 AND q.subject=s.subject) correct,
        (SELECT COUNT(*) FROM attempt_items ai JOIN attempts a ON a.id=ai.attempt_id JOIN questions q ON q.id=ai.question_id
           WHERE a.submitted_at IS NOT NULL AND ai.chosen IS NOT NULL AND ai.is_correct IS NULL AND q.subject=s.subject) ungradable,
        (SELECT COUNT(*) FROM wrong_book w JOIN questions q ON q.id=w.question_id WHERE w.status='ACTIVE' AND q.subject=s.subject) wrong_active,
        (SELECT COUNT(*) FROM wrong_book w JOIN questions q ON q.id=w.question_id WHERE w.status='FAMILIAR' AND q.subject=s.subject) wrong_familiar,
        (SELECT COUNT(*) FROM bookmarks b JOIN questions q ON q.id=b.question_id WHERE q.subject=s.subject) bookmarks
       FROM (SELECT 'ACCOUNTING' subject UNION ALL SELECT 'MONEY_BANKING' UNION ALL SELECT 'NEGOTIABLE_INSTRUMENTS'
             UNION ALL SELECT 'BANKING_ACT' UNION ALL SELECT 'UNCLASSIFIED') s`,
    )
    .all() as SubjectStat[];
}

export function topicStats() {
  return db()
    .prepare(
      `SELECT q.subject, COALESCE(t.name, '（未設定主題）') topic,
         COUNT(*) gradable, SUM(ai.is_correct) correct
       FROM attempt_items ai JOIN attempts a ON a.id=ai.attempt_id
       JOIN questions q ON q.id=ai.question_id LEFT JOIN topics t ON t.id=q.topic_id
       WHERE a.submitted_at IS NOT NULL AND ai.is_correct IS NOT NULL
       GROUP BY q.subject, q.topic_id ORDER BY q.subject, t.sort`,
    )
    .all() as { subject: string; topic: string; gradable: number; correct: number }[];
}

export function attemptHistory(limit = 50) {
  return db()
    .prepare(
      `SELECT * FROM attempts ORDER BY COALESCE(submitted_at, started_at) DESC, id DESC LIMIT ?`,
    )
    .all(limit) as {
    id: number;
    mode: string;
    title: string | null;
    started_at: string;
    submitted_at: string | null;
    total: number;
    answered: number | null;
    gradable: number | null;
    correct: number | null;
  }[];
}

export function dailyStats(days = 14) {
  return db()
    .prepare(
      `SELECT substr(a.submitted_at,1,10) day, COUNT(*) answered, SUM(ai.is_correct) correct, COUNT(ai.is_correct) gradable
       FROM attempt_items ai JOIN attempts a ON a.id=ai.attempt_id
       WHERE a.submitted_at IS NOT NULL AND ai.chosen IS NOT NULL
       GROUP BY day ORDER BY day DESC LIMIT ?`,
    )
    .all(days) as { day: string; answered: number; correct: number | null; gradable: number }[];
}

export function pct(correct: number | null | undefined, total: number | null | undefined): string {
  if (!total) return "—";
  return `${Math.round(((correct ?? 0) / total) * 100)}%`;
}

export function adminCounts() {
  const g = (sql: string) => (db().prepare(sql).get() as { n: number }).n;
  return {
    published: g("SELECT COUNT(*) n FROM questions WHERE status='PUBLISHED'"),
    archived: g("SELECT COUNT(*) n FROM questions WHERE status='ARCHIVED'"),
    unverified: g("SELECT COUNT(*) n FROM questions WHERE verify_status IN ('UNVERIFIED','MISMATCH')"),
    explanationPending: g("SELECT COUNT(*) n FROM questions WHERE explanation_status='PENDING'"),
    unclassified: g("SELECT COUNT(*) n FROM questions WHERE subject='UNCLASSIFIED'"),
    missingAnswer: g("SELECT COUNT(*) n FROM questions WHERE answer_status='MISSING'"),
    lawRecheck: g(
      "SELECT COUNT(*) n FROM questions WHERE subject IN ('NEGOTIABLE_INSTRUMENTS','BANKING_ACT') AND COALESCE(law_recheck,'UNKNOWN') IN ('UNKNOWN','NEEDS_RECHECK')",
    ),
    missingSource: g(
      "SELECT COUNT(*) n FROM questions q JOIN exam_papers p ON p.id=q.paper_id WHERE p.source_type!='DEMO' AND (p.paper_url IS NULL OR p.paper_url='')",
    ),
    pendingImports: g("SELECT COUNT(*) n FROM import_items WHERE published_question_id IS NULL"),
  };
}
