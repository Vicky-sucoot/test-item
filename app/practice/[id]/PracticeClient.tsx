"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { answerAction, submitAction, toggleBookmarkAction } from "../../actions";

type Reveal = {
  isCorrect: boolean | null;
  answer: string | null;
  answerText: string;
  answerStatus: string;
  explanation: string | null;
  explanationStatus: string;
};

export interface PracticeQuestion {
  seq: number;
  id: number;
  stem: string;
  options: (string | null)[];
  optionStyle: string;
  subject: string;
  topic: string | null;
  sourceType: string;
  sourceShort: string;
  paper: string;
  missingAnswer: boolean;
  bookmarked: boolean;
  chosen: string | null;
  reveal: Reveal | null;
}

const KEYS = ["A", "B", "C", "D"];
const label = (k: string, style: string) => (style === "NUMERIC" ? `(${KEYS.indexOf(k) + 1})` : `(${k})`);

export default function PracticeClient({
  attemptId,
  title,
  instant,
  questions,
  exam,
}: {
  attemptId: number;
  title: string;
  instant: boolean;
  questions: PracticeQuestion[];
  exam?: { deadlineMs: number; serverNow: number; limitSec: number } | null;
}) {
  const [idx, setIdx] = useState(() => {
    const first = questions.findIndex((q) => !q.chosen);
    return first < 0 ? 0 : first;
  });
  const [chosen, setChosen] = useState<Record<number, string | null>>(
    Object.fromEntries(questions.map((q) => [q.seq, q.chosen])),
  );
  const [reveals, setReveals] = useState<Record<number, Reveal | null>>(
    Object.fromEntries(questions.map((q) => [q.seq, q.reveal])),
  );
  const [marks, setMarks] = useState<Record<number, boolean>>(
    Object.fromEntries(questions.map((q) => [q.id, q.bookmarked])),
  );
  const [error, setError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [pending, start] = useTransition();
  const remaining = useCountdown(exam ?? null);
  const autoSubmitted = useRef(false);
  const timeUp = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (!timeUp || autoSubmitted.current) return;
    autoSubmitted.current = true;
    start(async () => {
      await submitAction(attemptId, "TIMEOUT");
    });
  }, [timeUp, attemptId]);

  if (!questions.length) {
    return (
      <div className="card">
        此次練習沒有題目。<Link className="link" href="/questions">回題庫</Link>
      </div>
    );
  }

  const q = questions[idx];
  const reveal = reveals[q.seq];
  const answeredCount = Object.values(chosen).filter(Boolean).length;
  const locked = instant && !!reveal;

  function choose(k: string) {
    if (locked || pending || timeUp) return;
    const prev = chosen[q.seq];
    const next = prev === k && !instant ? null : k;
    setChosen((c) => ({ ...c, [q.seq]: next }));
    setError(null);
    start(async () => {
      const r = await answerAction(attemptId, q.seq, next);
      if (!r.ok) {
        setError(r.error);
        setChosen((c) => ({ ...c, [q.seq]: prev }));
      } else if (r.revealed) {
        setReveals((m) => ({ ...m, [q.seq]: r }));
      }
    });
  }

  function submit() {
    const unanswered = questions.length - answeredCount;
    if (unanswered > 0 && !confirm(`還有 ${unanswered} 題未作答，確定要交卷嗎？`)) return;
    start(async () => {
      await submitAction(attemptId, "MANUAL");
    });
  }

  function bookmark() {
    start(async () => {
      const on = await toggleBookmarkAction(q.id);
      setMarks((m) => ({ ...m, [q.id]: on }));
    });
  }

  const ansSet = reveal?.answer ? (reveal.answer === "*" ? KEYS : reveal.answer.split(",")) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-semibold">{title}</h1>
          <p className="text-xs muted">
            已作答 {answeredCount} / {questions.length}　{exam ? "限時模擬考" : instant ? "即時回饋模式" : "交卷後看答案"}
          </p>
        </div>
        {remaining !== null && (
          <div
            role="timer"
            suppressHydrationWarning
            aria-live="off"
            className={`rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
              remaining <= 300 ? "bg-red-600 text-white" : "bg-slate-800 text-white"
            }`}
            title="剩餘時間"
          >
            ⏱ {fmt(remaining)}
          </div>
        )}
        <button className="btn btn-outline btn-sm" onClick={() => setShowGrid((s) => !s)}>
          題號盤 ▦
        </button>
      </div>

      {timeUp && (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">時間到，正在自動交卷…</p>
      )}
      {remaining !== null && remaining > 0 && remaining <= 300 && (
        <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800">剩不到 5 分鐘，時間到會自動交卷。</p>
      )}

      {showGrid && (
        <div className="card grid grid-cols-8 gap-1.5 sm:grid-cols-12">
          {questions.map((x, i) => {
            const r = reveals[x.seq];
            let cls = "bg-white";
            if (r?.isCorrect === true) cls = "bg-emerald-100";
            else if (r?.isCorrect === false) cls = "bg-red-100";
            else if (chosen[x.seq]) cls = "bg-sky-100";
            return (
              <button
                key={x.seq}
                onClick={() => {
                  setIdx(i);
                  setShowGrid(false);
                }}
                className={`rounded border py-1 text-xs ${cls} ${i === idx ? "ring-2 ring-sky-500" : ""}`}
                style={{ borderColor: "var(--line)" }}
              >
                {x.seq}
              </button>
            );
          })}
        </div>
      )}

      <article className="card space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded border px-1.5 py-0.5" style={{ borderColor: "var(--line)" }}>{q.subject}</span>
          {q.topic && <span className="rounded border px-1.5 py-0.5" style={{ borderColor: "var(--line)" }}>{q.topic}</span>}
          <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5">{q.sourceShort}</span>
          <span className="muted">{q.paper}</span>
          <button onClick={bookmark} className="ml-auto text-sm" aria-label="收藏">
            {marks[q.id] ? "★ 已收藏" : "☆ 收藏"}
          </button>
        </div>
        {q.sourceType === "DEMO" && (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">⚠ 自編示範題，非歷屆真題。</p>
        )}
        {q.sourceType === "FIT_REFERENCE" && (
          <p className="rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-900">FIT 參考試題，非銀行甄試題。</p>
        )}
        {q.missingAnswer && (
          <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">本題缺少官方答案，作答後不判分。</p>
        )}
        <p className="whitespace-pre-wrap text-base leading-relaxed">
          <span className="mr-1 font-semibold">{q.seq}.</span>
          {q.stem}
        </p>
        <div className="space-y-2">
          {KEYS.map((k, i) => {
            const text = q.options[i];
            if (!text) return null;
            const isChosen = chosen[q.seq] === k;
            let cls = "border-slate-200 hover:bg-slate-50";
            if (reveal && ansSet.includes(k)) cls = "border-emerald-500 bg-emerald-50";
            else if (reveal && isChosen) cls = "border-red-400 bg-red-50";
            else if (isChosen) cls = "border-sky-500 bg-sky-50";
            return (
              <button
                key={k}
                onClick={() => choose(k)}
                disabled={locked || timeUp}
                className={`flex w-full gap-2 rounded-lg border px-3 py-3 text-left text-sm transition ${cls}`}
              >
                <span className="font-semibold">{label(k, q.optionStyle)}</span>
                <span className="flex-1">{text}</span>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}

        {reveal && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-semibold">
              {reveal.isCorrect === true && <span className="text-emerald-700">答對了！</span>}
              {reveal.isCorrect === false && <span className="text-red-700">答錯了。</span>}
              {reveal.isCorrect === null && <span className="text-slate-700">無法判分。</span>}
              <span className="ml-2 font-normal">答案：{reveal.answerText}</span>
              {reveal.answerStatus === "SELF_WRITTEN" && <span className="ml-1 text-xs text-amber-800">（自編參考答案，非官方）</span>}
            </p>
            {reveal.explanation ? (
              <div>
                <p className="text-xs text-amber-800">
                  {reveal.explanationStatus === "REVIEWED" ? "解析已審核" : "解析草稿（待審核）"}
                </p>
                <p className="whitespace-pre-wrap">{reveal.explanation}</p>
              </div>
            ) : (
              <p className="muted">尚無解析。</p>
            )}
          </div>
        )}
      </article>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t bg-white/95 px-4 py-3 backdrop-blur" style={{ borderColor: "var(--line)" }}>
        {remaining !== null && (
          <span
            suppressHydrationWarning
            className={`font-mono text-sm font-bold tabular-nums ${remaining <= 300 ? "text-red-700" : ""}`}
            aria-label="剩餘時間"
          >
            ⏱ {fmt(remaining)}
          </span>
        )}
        <button className="btn btn-outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          上一題
        </button>
        <button className="btn btn-outline" disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)}>
          下一題
        </button>
        <button className="btn btn-primary ml-auto" onClick={submit} disabled={pending || timeUp}>
          交卷
        </button>
      </div>
    </div>
  );
}

/** 依伺服器時間計算剩餘秒數（修正使用者電腦時鐘誤差） */
function useCountdown(exam: { deadlineMs: number; serverNow: number } | null): number | null {
  const [offset] = useState(() => (exam ? exam.serverNow - Date.now() : 0));
  const calc = () => (exam ? Math.max(0, Math.ceil((exam.deadlineMs - (Date.now() + offset)) / 1000)) : null);
  const [left, setLeft] = useState<number | null>(calc);
  useEffect(() => {
    if (!exam) return;
    const t = setInterval(() => setLeft(calc()), 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam?.deadlineMs]);
  return left;
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
