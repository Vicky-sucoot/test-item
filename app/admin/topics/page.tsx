import { db } from "@/lib/db";
import { getTopics } from "@/lib/questions";
import { SUBJECTS, SUBJECT_LABEL } from "@/lib/constants";
import { addTopicAction, deleteTopicAction, updateTopicAction } from "../actions";

export default async function TopicsPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const topics = getTopics();
  const usage = new Map(
    (db().prepare("SELECT topic_id, COUNT(*) n FROM questions WHERE topic_id IS NOT NULL GROUP BY topic_id").all() as {
      topic_id: number;
      n: number;
    }[]).map((r) => [r.topic_id, r.n]),
  );
  return (
    <div className="space-y-4">
      <h1 className="h1">主題章節</h1>
      <p className="text-sm muted">預設章節可自由修改名稱、排序或新增。刪除主題後，原本屬於該主題的題目會變成「未設定主題」。</p>
      {err && <p className="rounded bg-red-50 p-2 text-sm text-red-800">{err}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {SUBJECTS.map((s) => (
          <section key={s} className="card space-y-2">
            <h2 className="h2">{SUBJECT_LABEL[s]}</h2>
            {topics
              .filter((t) => t.subject === s)
              .map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <form action={updateTopicAction} className="flex flex-1 items-center gap-1.5">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="sort" defaultValue={t.sort} className="input w-14" aria-label="排序" inputMode="numeric" />
                    <input name="name" defaultValue={t.name} className="input flex-1" aria-label="主題名稱" />
                    <button className="btn btn-outline btn-sm">更新</button>
                  </form>
                  <span className="w-10 text-right text-xs muted">{usage.get(t.id) ?? 0} 題</span>
                  <form action={deleteTopicAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn btn-danger btn-sm">刪除</button>
                  </form>
                </div>
              ))}
            <form action={addTopicAction} className="flex gap-1.5 pt-1">
              <input type="hidden" name="subject" value={s} />
              <input name="name" className="input flex-1" placeholder="新增主題" aria-label={`新增${SUBJECT_LABEL[s]}主題`} />
              <button className="btn btn-primary btn-sm">新增</button>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
