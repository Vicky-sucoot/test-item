import { notFound, redirect } from "next/navigation";
import { getAttempt, getAttemptItems } from "@/lib/practice";
import { getQuestionsByIds } from "@/lib/questions";
import { grade, formatAnswer } from "@/lib/answer";
import { SOURCE_TYPE_SHORT, subjectLabel } from "@/lib/constants";
import { paperTitle } from "@/components/QuestionView";
import PracticeClient, { type PracticeQuestion } from "./PracticeClient";

export const dynamic = "force-dynamic";

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const attempt = getAttempt(id);
  if (!attempt) notFound();
  if (attempt.submitted_at) redirect(`/practice/${id}/result`);
  const items = getAttemptItems(id);
  const qs = getQuestionsByIds(items.map((i) => i.question_id));
  const questions: PracticeQuestion[] = items.flatMap((it) => {
    const q = qs.get(it.question_id);
    if (!q) return [];
    // 只在即時回饋模式且已作答時，才把答案送到瀏覽器
    const reveal =
      attempt.instant_feedback && it.chosen
        ? {
            isCorrect: grade(it.chosen, q.official_answer, q.answer_status),
            answer: q.official_answer,
            answerText: q.answer_status === "MISSING" ? "缺少官方答案（不判分）" : formatAnswer(q.official_answer, q.option_style),
            answerStatus: q.answer_status,
            explanation: q.explanation,
            explanationStatus: q.explanation_status,
          }
        : null;
    return [
      {
        seq: it.seq,
        id: q.id,
        stem: q.stem,
        options: [q.option_a, q.option_b, q.option_c, q.option_d],
        optionStyle: q.option_style,
        subject: subjectLabel(q.subject),
        topic: q.topic_name,
        sourceType: q.source_type,
        sourceShort: SOURCE_TYPE_SHORT[q.source_type],
        paper: paperTitle(q) + (q.number_in_paper != null ? ` 第 ${q.number_in_paper} 題` : ""),
        missingAnswer: q.answer_status === "MISSING",
        bookmarked: !!q.bookmarked,
        chosen: it.chosen,
        reveal,
      },
    ];
  });
  return (
    <PracticeClient
      attemptId={id}
      title={attempt.title ?? "練習"}
      instant={!!attempt.instant_feedback}
      questions={questions}
    />
  );
}
