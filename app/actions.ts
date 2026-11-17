"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { filtersToQuery, getQuestion, parseFilters, selectQuestionIds, toggleBookmark } from "@/lib/questions";
import { createAttempt, getAttemptItems, saveAnswer, setWrongStatus, submitAttempt } from "@/lib/practice";
import { formatAnswer } from "@/lib/answer";
import { subjectLabel } from "@/lib/constants";
import { db } from "@/lib/db";

function titleFor(fd: FormData): string {
  const f = parseFilters(fd);
  const parts: string[] = [];
  if (f.only === "wrong") parts.push("錯題複習");
  if (f.only === "familiar") parts.push("已熟悉題複習");
  if (f.only === "bookmark") parts.push("收藏題");
  parts.push(f.subject ? subjectLabel(f.subject) : "全部科目");
  if (f.bank) parts.push(f.bank);
  if (f.year) parts.push(`${f.year} 年`);
  return parts.join("・");
}

export async function startPracticeAction(fd: FormData) {
  const f = parseFilters(fd);
  const count = Math.min(Math.max(Number(fd.get("count") || 20), 1), 200);
  const order = fd.get("order") === "seq" ? "seq" : "random";
  const ids = selectQuestionIds(f, count, order);
  if (!ids.length) redirect(`/questions?${filtersToQuery(f)}&empty=1`);
  const mode = f.only === "wrong" || f.only === "familiar" ? "REVIEW" : "PRACTICE";
  const id = createAttempt(ids, {
    mode,
    title: titleFor(fd),
    instant: fd.get("instant") === "1",
    filters: filtersToQuery(f),
  });
  redirect(`/practice/${id}`);
}

export async function retryWrongAction(fd: FormData) {
  const attemptId = Number(fd.get("attemptId"));
  const items = getAttemptItems(attemptId).filter((i) => i.is_correct === 0 || (!i.chosen && i.is_correct === null));
  const ids = items
    .filter((i) => {
      if (i.is_correct === 0) return true;
      const q = getQuestion(i.question_id);
      return !i.chosen && q && q.answer_status !== "MISSING";
    })
    .map((i) => i.question_id);
  if (!ids.length) redirect(`/practice/${attemptId}/result`);
  const id = createAttempt(ids, { mode: "RETRY_WRONG", title: `重練第 ${attemptId} 次練習的錯題`, instant: false });
  redirect(`/practice/${id}`);
}

export async function answerAction(attemptId: number, seq: number, choice: string | null) {
  try {
    const r = saveAnswer(attemptId, seq, choice);
    if (!r.revealed) return { ok: true as const, revealed: false as const };
    const item = db()
      .prepare("SELECT question_id FROM attempt_items WHERE attempt_id=? AND seq=?")
      .get(attemptId, seq) as { question_id: number };
    const q = getQuestion(item.question_id)!;
    return {
      ok: true as const,
      revealed: true as const,
      isCorrect: r.isCorrect,
      answer: q.official_answer,
      answerText: q.answer_status === "MISSING" ? "缺少官方答案（不判分）" : formatAnswer(q.official_answer, q.option_style),
      answerStatus: q.answer_status,
      explanation: q.explanation,
      explanationStatus: q.explanation_status,
    };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function submitAction(attemptId: number) {
  submitAttempt(attemptId);
  revalidatePath("/", "layout");
  redirect(`/practice/${attemptId}/result`);
}

export async function toggleBookmarkAction(questionId: number) {
  const on = toggleBookmark(questionId);
  revalidatePath("/review");
  return on;
}

export async function toggleBookmarkFormAction(fd: FormData) {
  toggleBookmark(Number(fd.get("questionId")));
  revalidatePath("/", "layout");
}

export async function setWrongStatusAction(fd: FormData) {
  const status = fd.get("status") === "FAMILIAR" ? "FAMILIAR" : "ACTIVE";
  setWrongStatus(Number(fd.get("questionId")), status);
  revalidatePath("/", "layout");
}
