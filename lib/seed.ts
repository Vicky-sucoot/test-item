// 預設主題、來源檢查表與自編示範題
// 注意：以下題目全部為「自編示範題」，非任何銀行歷屆真題；答案為自編參考答案，非官方答案。
import type Database from "better-sqlite3";
import { BANKS, type Subject } from "./constants";
import { stemHash } from "./normalize";

export const DEFAULT_TOPICS: Record<Exclude<Subject, "UNCLASSIFIED">, string[]> = {
  ACCOUNTING: [
    "會計基本概念與財務報表",
    "現金與應收款項",
    "存貨",
    "不動產、廠房及設備",
    "無形資產",
    "負債",
    "權益",
    "收入與費用認列",
    "金融工具與投資",
    "現金流量表",
    "財務報表分析",
    "銀行業會計",
  ],
  MONEY_BANKING: [
    "貨幣的功能與定義",
    "貨幣供給與存款創造",
    "中央銀行與貨幣政策",
    "利率理論與利率結構",
    "金融市場與金融工具",
    "金融中介與銀行經營",
    "銀行風險管理與資本適足",
    "國際金融與匯率",
    "通貨膨脹與總體經濟",
  ],
  NEGOTIABLE_INSTRUMENTS: [
    "通則（票據種類與票據行為）",
    "匯票",
    "本票",
    "支票",
    "背書",
    "保證",
    "付款與追索權",
    "時效與利益償還",
    "票據喪失",
  ],
  BANKING_ACT: [
    "通則與銀行種類",
    "銀行設立與負責人",
    "存款規範",
    "授信規範",
    "利害關係人交易",
    "資本與財務規範",
    "商業銀行",
    "專業銀行與信託",
    "外國銀行",
    "監理與罰則",
  ],
};

export const DEFAULT_ISSUERS = [...BANKS, "台灣金融研訓院"];

interface DemoQ {
  subject: Exclude<Subject, "UNCLASSIFIED">;
  topic: string;
  stem: string;
  options: [string, string, string, string];
  answer: string | null;
  explanation: string;
}

const LAW_NOTE = "（解析草稿未引用條號；條文請以全國法規資料庫現行條文核對後再審核。）";

export const DEMO_QUESTIONS: DemoQ[] = [
  // 會計學
  {
    subject: "ACCOUNTING",
    topic: "會計基本概念與財務報表",
    stem: "【示範】下列何者通常屬於流動資產？",
    options: ["土地", "應收帳款", "專利權", "機器設備"],
    answer: "B",
    explanation: "應收帳款預期於一年或一個營業週期內收現，屬流動資產；土地、機器設備屬不動產、廠房及設備，專利權屬無形資產，皆為非流動資產。",
  },
  {
    subject: "ACCOUNTING",
    topic: "存貨",
    stem: "【示範】在物價持續上漲且存貨數量不變的情況下，採用下列何種成本公式，期末存貨金額較高？",
    options: ["先進先出法", "加權平均法", "兩者相同", "資料不足無法判斷"],
    answer: "A",
    explanation: "先進先出法假設先購入者先售出，期末存貨由較晚、單價較高的進貨組成；物價上漲時，其期末存貨金額高於加權平均法。",
  },
  {
    subject: "ACCOUNTING",
    topic: "不動產、廠房及設備",
    stem: "【示範】機器成本 $100,000，估計殘值 $10,000，耐用年限 5 年，採直線法提列折舊，每年折舊費用為何？",
    options: ["$18,000", "$20,000", "$22,000", "$10,000"],
    answer: "A",
    explanation: "直線法每年折舊 =（成本 − 殘值）÷ 耐用年限 =（100,000 − 10,000）÷ 5 = 18,000。",
  },
  {
    subject: "ACCOUNTING",
    topic: "現金與應收款項",
    stem: "【示範】編製銀行往來調節表時，下列何者應調整「公司帳」上的存款餘額？",
    options: ["在途存款", "未兌現支票", "銀行代收票據款項，公司尚未入帳", "銀行誤記他戶存款"],
    answer: "C",
    explanation: "銀行已代收而公司尚未入帳，屬公司帳應補記的項目；在途存款、未兌現支票及銀行錯誤則調整銀行對帳單餘額。",
  },
  {
    subject: "ACCOUNTING",
    topic: "現金流量表",
    stem: "【示範】企業以現金購買機器設備，於現金流量表中應列為下列何種活動？",
    options: ["營業活動", "投資活動", "籌資活動", "不影響現金流量"],
    answer: "B",
    explanation: "取得不動產、廠房及設備之現金支出屬投資活動。",
  },
  // 貨幣銀行學
  {
    subject: "MONEY_BANKING",
    topic: "貨幣的功能與定義",
    stem: "【示範】以貨幣衡量各種商品與勞務的價值，屬於貨幣的哪一種功能？",
    options: ["交易媒介", "計價單位", "價值儲藏", "延期支付標準"],
    answer: "B",
    explanation: "以貨幣作為衡量與比較價值的共同尺度，即計價單位（記帳單位）功能。",
  },
  {
    subject: "MONEY_BANKING",
    topic: "貨幣供給與存款創造",
    stem: "【示範】若法定準備率為 10%，銀行不保留超額準備，且無現金外流，簡單存款乘數為多少？",
    options: ["5", "9", "10", "11"],
    answer: "C",
    explanation: "簡單存款乘數 = 1 ÷ 法定準備率 = 1 ÷ 0.1 = 10。",
  },
  {
    subject: "MONEY_BANKING",
    topic: "中央銀行與貨幣政策",
    stem: "【示範】中央銀行在公開市場買入票券，在其他條件不變下，通常會使下列何者發生？",
    options: ["準備貨幣減少", "貨幣供給增加", "市場利率上升", "銀行超額準備減少"],
    answer: "B",
    explanation: "央行買入票券並支付資金，銀行準備增加，經存款創造使貨幣供給增加，市場利率傾向下降。",
  },
  {
    subject: "MONEY_BANKING",
    topic: "利率理論與利率結構",
    stem: "【示範】若名目利率為 5%，預期通貨膨脹率為 2%，依費雪方程式之近似式，預期實質利率約為多少？",
    options: ["2%", "3%", "5%", "7%"],
    answer: "B",
    explanation: "實質利率 ≈ 名目利率 − 預期通貨膨脹率 = 5% − 2% = 3%。",
  },
  {
    subject: "MONEY_BANKING",
    topic: "利率理論與利率結構",
    stem: "【示範】依純粹預期理論，若市場預期未來短期利率將上升，殖利率曲線通常呈現何種形狀？",
    options: ["正斜率（右上方傾斜）", "負斜率（右下方傾斜）", "水平", "垂直"],
    answer: "A",
    explanation: "長期利率為預期未來短期利率的平均，預期短期利率上升時，長期利率高於短期利率，曲線呈正斜率。",
  },
  // 票據法
  {
    subject: "NEGOTIABLE_INSTRUMENTS",
    topic: "通則（票據種類與票據行為）",
    stem: "【示範】依我國票據法，票據的種類為下列何者？",
    options: ["匯票、本票及支票", "匯票、本票、支票及信用狀", "本票及支票", "匯票、支票及倉單"],
    answer: "A",
    explanation: "我國票據法所稱票據為匯票、本票及支票三種。" + LAW_NOTE,
  },
  {
    subject: "NEGOTIABLE_INSTRUMENTS",
    topic: "支票",
    stem: "【示範】依票據法，支票之付款人以下列何者為限？",
    options: ["金融業者", "任何自然人", "發票人本人", "任何公司行號"],
    answer: "A",
    explanation: "支票係委託金融業者於見票時無條件支付，付款人以金融業者為限。" + LAW_NOTE,
  },
  {
    subject: "NEGOTIABLE_INSTRUMENTS",
    topic: "本票",
    stem: "【示範】依票據法，本票發票人所負的責任，與下列何者相同？",
    options: ["匯票發票人", "匯票承兌人", "匯票背書人", "支票付款人"],
    answer: "B",
    explanation: "本票發票人負絕對付款責任，其責任與匯票承兌人相同。" + LAW_NOTE,
  },
  {
    subject: "NEGOTIABLE_INSTRUMENTS",
    topic: "背書",
    stem: "【示範】背書人於票據上記載「禁止轉讓」後，被背書人仍以背書轉讓他人，下列敘述何者正確？",
    options: [
      "該背書轉讓無效",
      "仍得轉讓，但記載禁止轉讓之背書人，對禁止後再由背書取得票據之人不負責任",
      "發票人因此免除責任",
      "須經付款人同意始得轉讓",
    ],
    answer: "B",
    explanation: "背書人記載禁止轉讓，票據仍得依背書轉讓，但該背書人對禁止後再由背書取得之人不負責任。" + LAW_NOTE,
  },
  {
    subject: "NEGOTIABLE_INSTRUMENTS",
    topic: "支票",
    stem: "【示範】支票正面劃平行線二道者，付款人僅得對下列何者支付票據金額？",
    options: ["金融業者", "執票人本人", "發票人", "任何持票之人"],
    answer: "A",
    explanation: "劃平行線之支票，付款人僅得對金融業者支付票據金額。" + LAW_NOTE,
  },
  // 銀行法
  {
    subject: "BANKING_ACT",
    topic: "通則與銀行種類",
    stem: "【示範】依銀行法，銀行分為下列哪三種？",
    options: [
      "商業銀行、專業銀行、信託投資公司",
      "商業銀行、儲蓄銀行、外國銀行",
      "公營銀行、民營銀行、外國銀行",
      "商業銀行、工業銀行、農業銀行",
    ],
    answer: "A",
    explanation: "銀行法將銀行分為商業銀行、專業銀行及信託投資公司三種。" + LAW_NOTE,
  },
  {
    subject: "BANKING_ACT",
    topic: "通則與銀行種類",
    stem: "【示範】銀行法之主管機關為下列何者？",
    options: ["中央銀行", "金融監督管理委員會", "財政部", "經濟部"],
    answer: "B",
    explanation: "銀行法之主管機關為金融監督管理委員會。" + LAW_NOTE,
  },
  {
    subject: "BANKING_ACT",
    topic: "利害關係人交易",
    stem: "【示範】依銀行法，銀行對其負責人原則上不得為下列何種授信（消費者貸款及對政府貸款除外）？",
    options: ["無擔保授信", "擔保授信", "任何授信", "外幣授信"],
    answer: "A",
    explanation: "銀行原則上不得對其負責人、職員、主要股東等利害關係人為無擔保授信，但消費者貸款及對政府貸款不在此限。" + LAW_NOTE,
  },
  {
    subject: "BANKING_ACT",
    topic: "存款規範",
    stem: "【示範】下列何者不屬於銀行法所稱之存款種類？",
    options: ["支票存款", "活期存款", "定期存款", "信用狀"],
    answer: "D",
    explanation: "銀行法所稱存款包括支票存款、活期存款、定期存款等；信用狀為銀行辦理之授信或國際貿易業務工具，非存款。" + LAW_NOTE,
  },
  {
    subject: "BANKING_ACT",
    topic: "資本與財務規範",
    stem: "【示範】銀行各種存款應提存之準備金比率，由下列何者訂定？",
    options: ["中央銀行", "金融監督管理委員會", "財政部", "銀行公會"],
    answer: "A",
    explanation: "銀行存款準備金比率由中央銀行於法定範圍內訂定。" + LAW_NOTE,
  },
  // 示範「缺少答案」：故意不提供答案，用以展示系統不猜測答案
  {
    subject: "ACCOUNTING",
    topic: "權益",
    stem: "【示範・缺少答案】本題用於展示「缺少官方答案」的顯示方式：公司發放股票股利，對權益總額的影響為何？",
    options: ["增加", "減少", "不變", "視情況而定"],
    answer: null,
    explanation: "",
  },
];

export function seedDefaults(db: Database.Database) {
  const insTopic = db.prepare("INSERT OR IGNORE INTO topics(subject, name, sort) VALUES (?,?,?)");
  for (const [subject, names] of Object.entries(DEFAULT_TOPICS)) {
    names.forEach((n, i) => insTopic.run(subject, n, i + 1));
  }
  const insIssuer = db.prepare("INSERT OR IGNORE INTO source_checks(issuer, note) VALUES (?, ?)");
  for (const issuer of DEFAULT_ISSUERS) {
    insIssuer.run(issuer, "尚未檢查使用條件；目前僅供個人本機使用，不公開發布。");
  }
}

export function seedDemo(db: Database.Database) {
  const topicId = db.prepare("SELECT id FROM topics WHERE subject=? AND name=?");
  const insPaper = db.prepare(
    `INSERT INTO exam_papers(source_type, exam_name, subject_label, note) VALUES ('DEMO', ?, '綜合（示範）', ?)`,
  );
  const paperA = insPaper.run("自編示範題組 A", "系統自編示範資料，非任何銀行歷屆真題").lastInsertRowid;
  const paperB = insPaper.run("自編示範題組 B", "系統自編示範資料，非任何銀行歷屆真題；用於展示重複題標記").lastInsertRowid;

  const insQ = db.prepare(`INSERT INTO questions
    (paper_id, number_in_paper, subject, subject_source, topic_id, stem, option_a, option_b, option_c, option_d,
     official_answer, answer_status, answer_note, verify_status, explanation, explanation_status, stem_hash,
     law_at_exam, law_recheck)
    VALUES (?,?,?,'MANUAL',?,?,?,?,?,?,?,?,?,'NOT_APPLICABLE',?,?,?,?,?)`);

  const isLaw = (s: string) => s === "NEGOTIABLE_INSTRUMENTS" || s === "BANKING_ACT";
  const insert = (paper: number | bigint, num: number, q: DemoQ) => {
    const t = topicId.get(q.subject, q.topic) as { id: number } | undefined;
    return insQ.run(
      paper,
      num,
      q.subject,
      t?.id ?? null,
      q.stem,
      ...q.options,
      q.answer,
      q.answer ? "SELF_WRITTEN" : "MISSING",
      q.answer ? "示範題之自編參考答案，非官方答案" : "示範：刻意不提供答案",
      q.explanation || null,
      q.explanation ? "PENDING" : "NONE",
      stemHash(q.stem, q.options),
      null,
      isLaw(q.subject) ? "NEEDS_RECHECK" : null,
    ).lastInsertRowid;
  };

  const ids: (number | bigint)[] = [];
  DEMO_QUESTIONS.forEach((q, i) => ids.push(insert(paperA, i + 1, q)));

  // 題組 B：重複收錄兩題，展示「同題不同出處」的重複標記
  const group = db.prepare("INSERT INTO duplicate_groups(detect_method, confirmed, note) VALUES ('EXACT_TEXT', 1, ?)");
  const setGroup = db.prepare("UPDATE questions SET duplicate_group_id=? WHERE id=?");
  [
    [6, 1],
    [11, 2],
  ].forEach(([idx, num]) => {
    const dupId = insert(paperB, num, DEMO_QUESTIONS[idx]);
    const g = group.run("示範：同一題出現在兩份示範題組").lastInsertRowid;
    setGroup.run(g, ids[idx]);
    setGroup.run(g, dupId);
  });
}
