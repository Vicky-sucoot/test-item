// 共用常數與中文標籤

export const SUBJECTS = [
  "ACCOUNTING",
  "MONEY_BANKING",
  "NEGOTIABLE_INSTRUMENTS",
  "BANKING_ACT",
] as const;
export type Subject = (typeof SUBJECTS)[number] | "UNCLASSIFIED";

export const SUBJECT_LABEL: Record<Subject, string> = {
  ACCOUNTING: "會計學",
  MONEY_BANKING: "貨幣銀行學",
  NEGOTIABLE_INSTRUMENTS: "票據法",
  BANKING_ACT: "銀行法",
  UNCLASSIFIED: "待人工分類",
};
export const ALL_SUBJECTS: Subject[] = [...SUBJECTS, "UNCLASSIFIED"];

/** 需要標示法規欄位的科目 */
export const LAW_SUBJECTS: Subject[] = ["NEGOTIABLE_INSTRUMENTS", "BANKING_ACT"];

export const SUBJECT_SOURCE_LABEL: Record<string, string> = {
  MANUAL: "人工指定／確認",
  PAPER: "依原卷科目",
  AUTO: "系統建議（待確認）",
};

/** 第一階段收錄之銀行（依使用者指定順序） */
export const BANKS = [
  "第一銀行",
  "合作金庫",
  "臺灣銀行",
  "臺灣土地銀行",
  "華南銀行",
  "兆豐銀行",
  "彰化銀行",
  "臺灣中小企業銀行",
] as const;

export const SOURCE_TYPES = ["BANK_EXAM", "FIT_REFERENCE", "DEMO"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  BANK_EXAM: "銀行甄試題",
  FIT_REFERENCE: "FIT 參考試題（非銀行甄試題）",
  DEMO: "自編示範題（非歷屆真題）",
};
export const SOURCE_TYPE_SHORT: Record<SourceType, string> = {
  BANK_EXAM: "銀行甄試",
  FIT_REFERENCE: "FIT 參考",
  DEMO: "示範題",
};

export const ANSWER_STATUS = ["OFFICIAL", "OFFICIAL_AMENDED", "MISSING", "SELF_WRITTEN"] as const;
export type AnswerStatus = (typeof ANSWER_STATUS)[number];
export const ANSWER_STATUS_LABEL: Record<AnswerStatus, string> = {
  OFFICIAL: "官方答案",
  OFFICIAL_AMENDED: "官方更正答案",
  MISSING: "缺少官方答案",
  SELF_WRITTEN: "自編參考答案（非官方）",
};

export const VERIFY_STATUS = ["UNVERIFIED", "VERIFIED", "MISMATCH", "NOT_APPLICABLE"] as const;
export type VerifyStatus = (typeof VERIFY_STATUS)[number];
export const VERIFY_STATUS_LABEL: Record<VerifyStatus, string> = {
  UNVERIFIED: "未核對",
  VERIFIED: "已與原卷核對",
  MISMATCH: "與原卷不符，待修正",
  NOT_APPLICABLE: "不適用（自編示範題，無原卷）",
};

export const EXPLANATION_STATUS = ["NONE", "PENDING", "REVIEWED"] as const;
export type ExplanationStatus = (typeof EXPLANATION_STATUS)[number];
export const EXPLANATION_STATUS_LABEL: Record<ExplanationStatus, string> = {
  NONE: "尚無解析",
  PENDING: "解析待審核",
  REVIEWED: "解析已審核",
};

export const LAW_RECHECK = ["UNKNOWN", "NEEDS_RECHECK", "CHECKED_NO_CHANGE", "CHECKED_CHANGED"] as const;
export type LawRecheck = (typeof LAW_RECHECK)[number];
export const LAW_RECHECK_LABEL: Record<LawRecheck, string> = {
  UNKNOWN: "尚未判定",
  NEEDS_RECHECK: "需重新核對目前法規",
  CHECKED_NO_CHANGE: "已核對：目前法規無影響",
  CHECKED_CHANGED: "已核對：法規已修正，答案可能不同",
};

export const PERMISSION = ["UNKNOWN", "PENDING", "ALLOWED", "NOT_ALLOWED"] as const;
export type Permission = (typeof PERMISSION)[number];
export const PERMISSION_LABEL: Record<Permission, string> = {
  UNKNOWN: "未確認",
  PENDING: "已詢問，待回覆",
  ALLOWED: "已確認可重製",
  NOT_ALLOWED: "不可重製",
};

export const YES_NO_UNKNOWN_LABEL: Record<string, string> = {
  YES: "是",
  NO: "否",
  UNKNOWN: "未知",
};

export const QUESTION_STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "已發布（本機題庫）",
  ARCHIVED: "已下架",
};

export const WRONG_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "待複習",
  FAMILIAR: "已熟悉",
};

/** 連續答對幾次標記為已熟悉 */
export const FAMILIAR_STREAK = 2;

export const OPTION_KEYS = ["A", "B", "C", "D"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/** 依原卷選項樣式顯示選項標籤 */
export function optionLabel(key: string, style: string | null | undefined): string {
  if (style === "NUMERIC") return `(${OPTION_KEYS.indexOf(key as OptionKey) + 1})`;
  return `(${key})`;
}

export function subjectLabel(s: string | null | undefined): string {
  return SUBJECT_LABEL[(s ?? "UNCLASSIFIED") as Subject] ?? s ?? "";
}
