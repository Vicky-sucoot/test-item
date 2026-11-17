import {
  ANSWER_STATUS_LABEL,
  EXPLANATION_STATUS_LABEL,
  LAW_RECHECK_LABEL,
  SOURCE_TYPE_SHORT,
  VERIFY_STATUS_LABEL,
  subjectLabel,
  type AnswerStatus,
  type ExplanationStatus,
  type LawRecheck,
  type SourceType,
  type VerifyStatus,
} from "@/lib/constants";

type Tone = "gray" | "blue" | "green" | "amber" | "red" | "purple";
const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-sky-50 text-sky-800 border-sky-200",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-900 border-amber-300",
  red: "bg-red-50 text-red-800 border-red-300",
  purple: "bg-violet-50 text-violet-800 border-violet-200",
};

export function Badge({ tone = "gray", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function SourceBadge({ type }: { type: SourceType }) {
  const tone: Tone = type === "BANK_EXAM" ? "blue" : type === "FIT_REFERENCE" ? "purple" : "amber";
  return <Badge tone={tone}>{SOURCE_TYPE_SHORT[type]}</Badge>;
}

export function SubjectBadge({ subject }: { subject: string }) {
  return <Badge tone={subject === "UNCLASSIFIED" ? "red" : "gray"}>{subjectLabel(subject)}</Badge>;
}

export function AnswerStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "OFFICIAL" ? "green" : status === "OFFICIAL_AMENDED" ? "blue" : status === "MISSING" ? "red" : "amber";
  return <Badge tone={tone}>{ANSWER_STATUS_LABEL[status as AnswerStatus] ?? status}</Badge>;
}

export function VerifyBadge({ status }: { status: string }) {
  const tone: Tone = status === "VERIFIED" ? "green" : status === "NOT_APPLICABLE" ? "gray" : status === "MISMATCH" ? "red" : "amber";
  return <Badge tone={tone}>資料核對：{VERIFY_STATUS_LABEL[status as VerifyStatus] ?? status}</Badge>;
}

export function ExplanationBadge({ status }: { status: string }) {
  const tone: Tone = status === "REVIEWED" ? "green" : status === "PENDING" ? "amber" : "gray";
  return <Badge tone={tone}>{EXPLANATION_STATUS_LABEL[status as ExplanationStatus] ?? status}</Badge>;
}

export function LawRecheckBadge({ status }: { status: string | null }) {
  const s = (status ?? "UNKNOWN") as LawRecheck;
  const tone: Tone = s === "CHECKED_NO_CHANGE" ? "green" : s === "CHECKED_CHANGED" ? "red" : "amber";
  return <Badge tone={tone}>{LAW_RECHECK_LABEL[s] ?? s}</Badge>;
}

export function DemoNotice({ type }: { type: SourceType }) {
  if (type === "DEMO")
    return (
      <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
        ⚠ 自編示範題，非歷屆真題；答案為自編參考答案，非官方答案。
      </p>
    );
  if (type === "FIT_REFERENCE")
    return <p className="rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-900">FIT 參考試題，非銀行甄試題。</p>;
  return null;
}
