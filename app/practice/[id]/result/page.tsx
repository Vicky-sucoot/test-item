import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAttempt, getAttemptItems } from "@/lib/practice";
import { getCitations, getDuplicates, getQuestionsByIds } from "@/lib/questions";
import { pct } from "@/lib/stats";
import { formatDuration, usedSeconds } from "@/lib/exam";
import { subjectLabel } from "@/lib/constants";
import { Options, QuestionDetails, QuestionHeader } from "@/components/QuestionView";
import { Badge } from "@/components/Badges";
import { retryWrongAction, toggleBookmarkFormAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const id = Number((await params).id);
  const view = (await searchParams).view ?? "all";
  const attempt = getAttempt(id);
  if (!attempt) notFound();
  if (!attempt.submitted_at) redirect(`/practice/${id}`);
  const items = getAttemptItems(id);
  const qs = getQuestionsByIds(items.map((i) => i.question_id));
  const cites = getCitations(items.map((i) => i.question_id));

  const bySubject = new Map<string, { gradable: number; correct: number }>();
  for (const it of items) {
    const q = qs.get(it.question_id);
    if (!q || it.is_correct === null) continue;
    const s = bySubject.get(q.subject) ?? { gradable: 0, correct: 0 };
    s.gradable++;
    if (it.is_correct) s.correct++;
    bySubject.set(q.subject, s);
  }
  const wrongCount = items.filter((i) => i.is_correct === 0).length;
  const examLink = attempt.mode === "EXAM";
  const shown = items.filter((i) =>
    view === "wrong" ? i.is_correct === 0 : view === "unanswered" ? !i.chosen : true,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="card space-y-3">
        <h1 className="h1">{attempt.mode === "EXAM" ? "模擬考成績" : "交卷結果"}</h1>
        {attempt.mode === "EXAM" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-3xl font-bold">
              {attempt.gradable ? Math.round(((attempt.correct ?? 0) / attempt.gradable) * 100) : 0} 分
            </span>
            <span className="muted">（滿分 100，依可判分題數換算）</span>
            <Badge tone={attempt.submit_reason === "TIMEOUT" ? "amber" : "gray"}>
              {attempt.submit_reason === "TIMEOUT" ? "時間到自動交卷" : "手動交卷"}
            </Badge>
            <span>
              用時 {formatDuration(usedSeconds(attempt.started_at, attempt.submitted_at, attempt.time_limit_sec, attempt.submit_reason))}／時限{" "}
              {(attempt.time_limit_sec ?? 0) / 60} 分鐘
            </span>
          </div>
        )}
        <p className="text-sm muted">{attempt.title}　交卷時間 {attempt.submitted_at}</p>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <Stat label="正確率" value={pct(attempt.correct, attempt.gradable)} />
          <Stat label="答對 / 計分題數" value={`${attempt.correct} / ${attempt.gradable}`} />
          <Stat label="已作答 / 總題數" value={`${attempt.answered} / ${attempt.total}`} />
          <Stat label="無法判分（缺答案）" value={String((attempt.answered ?? 0) - (attempt.gradable ?? 0))} />
        </div>
        {bySubject.size > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {[...bySubject].map(([s, v]) => (
              <Badge key={s}>
                {subjectLabel(s)} {pct(v.correct, v.gradable)}（{v.correct}/{v.gradable}）
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs muted">
          {attempt.mode === "EXAM"
            ? "缺少官方答案的題目不判分、不列入成績；未作答題目計為答錯，但不加入錯題本。"
            : "缺少官方答案的題目不判分、不列入正確率；未作答題目不計分，也不加入錯題本。"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link className={`btn btn-sm ${view === "all" ? "btn-primary" : "btn-outline"}`} href="?view=all">全部</Link>
          <Link className={`btn btn-sm ${view === "wrong" ? "btn-primary" : "btn-outline"}`} href="?view=wrong">只看錯題（{wrongCount}）</Link>
          <Link className={`btn btn-sm ${view === "unanswered" ? "btn-primary" : "btn-outline"}`} href="?view=unanswered">未作答</Link>
          <form action={retryWrongAction}>
            <input type="hidden" name="attemptId" value={id} />
            <button className="btn btn-outline btn-sm" disabled={!wrongCount}>重練本次錯題</button>
          </form>
          <Link className="btn btn-outline btn-sm" href="/review">錯題本</Link>
          {examLink && <Link className="btn btn-outline btn-sm" href="/exam">再考一次</Link>}
        </div>
      </section>

      {shown.map((it) => {
        const q = qs.get(it.question_id);
        if (!q) return null;
        return (
          <article key={it.seq} className="card space-y-3" id={`q${it.seq}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>第 {it.seq} 題</span>
                {it.is_correct === 1 && <Badge tone="green">答對</Badge>}
                {it.is_correct === 0 && <Badge tone="red">{it.chosen ? "答錯" : "未作答（計為錯）"}</Badge>}
                {it.is_correct === null && <Badge>{it.chosen ? "無法判分" : "未作答"}</Badge>}
              </div>
              <form action={toggleBookmarkFormAction}>
                <input type="hidden" name="questionId" value={q.id} />
                <button className="text-sm">{q.bookmarked ? "★ 已收藏" : "☆ 收藏"}</button>
              </form>
            </div>
            <QuestionHeader q={q} />
            <p className="whitespace-pre-wrap leading-relaxed">{q.stem}</p>
            <Options q={q} chosen={it.chosen} showAnswer />
            <QuestionDetails q={q} citations={cites.get(q.id) ?? []} duplicates={getDuplicates(q)} />
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs muted">{label}</div>
    </div>
  );
}
