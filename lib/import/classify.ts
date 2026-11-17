// 科目分類建議（純函式）。只是建議，標示為「系統建議（待確認）」。
import type { Subject } from "../constants";

const KEYWORDS: Record<Exclude<Subject, "UNCLASSIFIED">, [string, number][]> = {
  NEGOTIABLE_INSTRUMENTS: [
    ["票據法", 3], ["票據", 2], ["匯票", 2], ["本票", 2], ["支票", 2], ["背書", 2], ["承兌", 2],
    ["追索", 2], ["執票人", 2], ["發票人", 1], ["平行線", 2], ["拒絕證書", 2], ["參加付款", 2], ["見票", 1],
  ],
  BANKING_ACT: [
    ["銀行法", 3], ["主管機關", 1], ["利害關係人", 2], ["無擔保授信", 2], ["授信", 1], ["商業銀行", 1],
    ["專業銀行", 2], ["信託投資公司", 2], ["銀行負責人", 2], ["資本適足", 1], ["外國銀行", 1], ["罰鍰", 1],
  ],
  ACCOUNTING: [
    ["分錄", 2], ["借記", 2], ["貸記", 2], ["折舊", 2], ["存貨", 2], ["應收帳款", 2], ["資產負債表", 2],
    ["綜合損益", 2], ["攤銷", 2], ["調節表", 2], ["會計", 2], ["銷貨成本", 2], ["淨利", 1], ["毛利", 2],
    ["現金流量", 2], ["權益", 1], ["應付", 1], ["殘值", 2],
  ],
  MONEY_BANKING: [
    ["貨幣供給", 2], ["貨幣需求", 2], ["貨幣政策", 2], ["貨幣", 1], ["通貨膨脹", 2], ["利率", 1],
    ["中央銀行", 1], ["存款乘數", 2], ["貨幣乘數", 2], ["準備貨幣", 2], ["M1B", 2], ["M2", 2], ["匯率", 1],
    ["殖利率", 2], ["流動性陷阱", 2], ["公開市場操作", 2], ["重貼現", 2],
  ],
};

export function suggestSubject(text: string): Subject {
  const scores = Object.entries(KEYWORDS).map(([s, kws]) => [
    s,
    kws.reduce((n, [k, w]) => n + (text.includes(k) ? w : 0), 0),
  ]) as [Subject, number][];
  scores.sort((a, b) => b[1] - a[1]);
  const [top, second] = scores;
  if (top[1] >= 2 && top[1] > second[1]) return top[0];
  return "UNCLASSIFIED";
}

/** 依原卷科目名稱判斷整卷科目；「綜合」或無法判斷時回傳 null（逐題分類） */
export function subjectFromPaperLabel(label: string | null | undefined): Subject | null {
  if (!label || label.includes("綜合")) return null;
  const hits: Subject[] = [];
  if (label.includes("會計")) hits.push("ACCOUNTING");
  if (label.includes("貨幣銀行") || label.includes("貨銀")) hits.push("MONEY_BANKING");
  if (label.includes("票據")) hits.push("NEGOTIABLE_INSTRUMENTS");
  if (label.includes("銀行法")) hits.push("BANKING_ACT");
  return hits.length === 1 ? hits[0] : null;
}
