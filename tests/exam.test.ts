import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, openDb } from "@/lib/db";
import { EXAM_PRESETS, allocate, createExam, finalizeExpiredExams, isExpired, usedSeconds, formatDuration } from "@/lib/exam";
import { getAttempt, getAttemptItems, saveAnswer, submitAttempt } from "@/lib/practice";
import { getQuestion } from "@/lib/questions";

describe("題數分配", () => {
  it("splits evenly and fills from the other subject", () => {
    expect(allocate(80, [100, 100])).toEqual([40, 40]);
    expect(allocate(80, [10, 100])).toEqual([10, 70]);
    expect(allocate(50, [3, 4])).toEqual([3, 4]);
    expect(allocate(5, [10, 10]).reduce((a, b) => a + b)).toBe(5);
    expect(allocate(0, [10, 10])).toEqual([0, 0]);
  });
});

describe("模擬考預設", () => {
  it("has the two configured presets", () => {
    expect(EXAM_PRESETS.map((p) => [p.subjects, p.count, p.minutes])).toEqual([
      [["ACCOUNTING", "MONEY_BANKING"], 80, 90],
      [["NEGOTIABLE_INSTRUMENTS", "BANKING_ACT"], 50, 60],
    ]);
  });
});

describe("模擬考流程（記憶體資料庫）", () => {
  it("creates an exam with deduped, answerable questions from both subjects", () => {
    const p = EXAM_PRESETS[0];
    const { attemptId, picked } = createExam({ ...p, sourceTypes: ["DEMO"], excludeMissing: true });
    // 示範題：會計 5 題可判分（1 題缺答案被排除）、貨銀 5 題（重複題只取一題）
    expect(picked).toBe(10);
    const a = getAttempt(attemptId!)!;
    expect(a.mode).toBe("EXAM");
    expect(a.time_limit_sec).toBe(90 * 60);
    expect(a.deadline_ms! - Date.now()).toBeGreaterThan(89 * 60 * 1000);
    const qs = getAttemptItems(attemptId!).map((i) => getQuestion(i.question_id)!);
    expect(new Set(qs.map((q) => q.subject))).toEqual(new Set(["ACCOUNTING", "MONEY_BANKING"]));
    expect(qs.some((q) => q.answer_status === "MISSING")).toBe(false);
    const groups = qs.map((q) => q.duplicate_group_id).filter((g) => g != null);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it("rejects answers after the deadline and auto-submits as TIMEOUT", () => {
    const { attemptId } = createExam({ ...EXAM_PRESETS[1], sourceTypes: ["DEMO"], excludeMissing: true });
    const id = attemptId!;
    const items = getAttemptItems(id);
    const q = getQuestion(items[0].question_id)!;
    saveAnswer(id, 1, q.official_answer!.split(",")[0]); // 第 1 題答對，其餘未作答
    db().prepare("UPDATE attempts SET deadline_ms=? WHERE id=?").run(Date.now() - 60_000, id);
    expect(isExpired(getAttempt(id)!)).toBe(true);
    expect(() => saveAnswer(id, 2, "A")).toThrow("時間已到");
    const wrongBefore = (db().prepare("SELECT COUNT(*) n FROM wrong_book").get() as { n: number }).n;
    expect(finalizeExpiredExams()).toBeGreaterThanOrEqual(1);
    const a = getAttempt(id)!;
    expect(a.submit_reason).toBe("TIMEOUT");
    expect(a.answered).toBe(1);
    expect(a.gradable).toBe(items.length); // 未作答計為答錯
    expect(a.correct).toBe(1);
    // 未作答不加入錯題本
    const wrongAfter = (db().prepare("SELECT COUNT(*) n FROM wrong_book").get() as { n: number }).n;
    expect(wrongAfter).toBe(wrongBefore);
    // 已交卷再交卷不會改變
    submitAttempt(id, "MANUAL");
    expect(getAttempt(id)!.submit_reason).toBe("TIMEOUT");
  });

  it("manual submission records MANUAL and adds wrong answers to the wrong book", () => {
    const { attemptId } = createExam({ ...EXAM_PRESETS[1], sourceTypes: ["DEMO"], excludeMissing: true });
    const id = attemptId!;
    const items = getAttemptItems(id);
    for (const it of items) {
      const ans = getQuestion(it.question_id)!.official_answer!;
      const wrong = ["A", "B", "C", "D"].find((k) => !ans.includes(k))!;
      saveAnswer(id, it.seq, wrong);
    }
    submitAttempt(id, "MANUAL");
    const a = getAttempt(id)!;
    expect(a.submit_reason).toBe("MANUAL");
    expect(a.correct).toBe(0);
    const n = (db().prepare(`SELECT COUNT(*) n FROM wrong_book WHERE question_id IN (${items.map((i) => i.question_id).join(",")})`).get() as { n: number }).n;
    expect(n).toBe(items.length);
  });
});

describe("舊資料庫升級", () => {
  it("adds exam columns to a phase-1 database", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "exam-mig-")), "old.db");
    const old = new Database(file);
    old.exec(`CREATE TABLE attempts (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, title TEXT, instant_feedback INTEGER NOT NULL DEFAULT 0,
      filters TEXT, started_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), submitted_at TEXT,
      total INTEGER, answered INTEGER, gradable INTEGER, correct INTEGER)`);
    old.close();
    const d = openDb(file);
    const cols = (d.prepare("PRAGMA table_info(attempts)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["time_limit_sec", "deadline_ms", "submit_reason"]));
    d.close();
  });
});

describe("用時顯示", () => {
  it("computes and formats", () => {
    expect(usedSeconds("2026-01-01 10:00:00", "2026-01-01 10:31:05")).toBe(1865);
    expect(usedSeconds("2026-01-01 10:00:00", "2026-01-01 12:00:00", 3600)).toBe(3600);
    expect(usedSeconds("2026-01-01 10:00:00", "2026-01-01 10:00:08", 3600, "TIMEOUT")).toBe(3600);
    expect(formatDuration(1865)).toBe("31 分 05 秒");
  });
});
