import Link from "next/link";
import { notFound } from "next/navigation";
import { getCitations, getDuplicates, getQuestion, questionHistory, wrongEntry } from "@/lib/questions";
import { Options, QuestionDetails, QuestionHeader } from "@/components/QuestionView";
import { Badge } from "@/components/Badges";
import { WRONG_STATUS_LABEL } from "@/lib/constants";
import { toggleBookmarkFormAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const q = getQuestion(Number((await params).id));
  if (!q) notFound();
  const show = (await searchParams).show === "1";
  const history = questionHistory(q.id);
  const w = wrongEntry(q.id);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link href="/questions" className="link text-sm">← 回題庫</Link>
      <article className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <QuestionHeader q={q} />
          <form action={toggleBookmarkFormAction}>
            <input type="hidden" name="questionId" value={q.id} />
            <button className="shrink-0 text-sm">{q.bookmarked ? "★ 已收藏" : "☆ 收藏"}</button>
          </form>
        </div>
        {q.status !== "PUBLISHED" && <Badge tone="red">此題已下架</Badge>}
        <p className="whitespace-pre-wrap leading-relaxed">{q.stem}</p>
        <Options q={q} showAnswer={show} />
        {show ? (
          <QuestionDetails q={q} citations={getCitations([q.id]).get(q.id) ?? []} duplicates={getDuplicates(q)} />
        ) : (
          <Link className="btn btn-outline" href={`/q/${q.id}?show=1`}>顯示答案、解析與來源</Link>
        )}
      </article>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">我的作答紀錄</h2>
        {w && (
          <p className="mb-2">
            錯題本：{WRONG_STATUS_LABEL[w.status]}・答錯 {w.wrong_count} 次・連續答對 {w.correct_streak} 次
          </p>
        )}
        {history.length ? (
          <ul className="space-y-1">
            {history.map((h, i) => (
              <li key={i}>
                {h.submitted_at}　選 {h.chosen ?? "（未作答）"}
                {h.is_correct === 1 ? "✔ 答對" : h.is_correct === 0 ? "✘ 答錯" : "－ 未判分"}
                <Link className="link" href={`/practice/${h.attempt_id}/result`}>該次結果</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">尚未作答過此題。</p>
        )}
      </section>
    </div>
  );
}
